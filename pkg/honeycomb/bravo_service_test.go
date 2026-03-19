package honeycomb

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/sstallion/go-hid"
)

func TestBravoServiceReconnectsAndEmitsEvents(t *testing.T) {
	device := &fakeHIDDevice{
		readResults: make(chan fakeReadResult, 4),
	}
	device.readResults <- fakeReadResult{n: bravoInputReportSize, payload: testReport(bravoSelectorIAS)}
	device.readResults <- fakeReadResult{n: bravoInputReportSize, payload: testReport(bravoSelectorIAS, bravoButtonEncoderUp)}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	attempts := 0
	svc := &bravoService{
		Logger:          NewConsoleLogger(),
		ctx:             ctx,
		cancelFunc:      cancel,
		events:          make(chan BravoEvent, 8),
		hidReportBuffer: make([]byte, bravoLEDReportSize),
		openDevice: func() (hidDevice, error) {
			attempts++
			if attempts == 1 {
				return nil, errors.New("device not ready")
			}
			return device, nil
		},
		readTimeout:    time.Millisecond,
		reconnectDelay: time.Millisecond,
	}

	svc.wg.Add(1)
	go svc.run()

	selector := waitForEvent(t, svc.Events())
	if selector.Kind != BravoEventSelector || selector.Name != "ias" {
		t.Fatalf("expected selector event, got %#v", selector)
	}

	encoder := waitForEvent(t, svc.Events())
	if encoder.Kind != BravoEventEncoder || encoder.Delta != 1 {
		t.Fatalf("expected encoder event, got %#v", encoder)
	}

	svc.Exit()

	if attempts < 2 {
		t.Fatalf("expected reconnect attempts, got %d", attempts)
	}
	if !device.closed {
		t.Fatalf("expected device to be closed on exit")
	}
}

func TestBravoServiceExitStopsWorker(t *testing.T) {
	device := &fakeHIDDevice{}
	ctx, cancel := context.WithCancel(context.Background())
	opened := make(chan struct{}, 1)

	svc := &bravoService{
		Logger:          NewConsoleLogger(),
		ctx:             ctx,
		cancelFunc:      cancel,
		events:          make(chan BravoEvent, 8),
		hidReportBuffer: make([]byte, bravoLEDReportSize),
		openDevice: func() (hidDevice, error) {
			select {
			case opened <- struct{}{}:
			default:
			}
			return device, nil
		},
		readTimeout:    time.Millisecond,
		reconnectDelay: time.Millisecond,
	}

	svc.wg.Add(1)
	go svc.run()

	select {
	case <-opened:
	case <-time.After(250 * time.Millisecond):
		t.Fatal("timed out waiting for HID device open")
	}

	done := make(chan struct{})
	go func() {
		svc.Exit()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(250 * time.Millisecond):
		t.Fatal("Exit timed out waiting for HID worker to stop")
	}

	if !device.closed {
		t.Fatalf("expected device to be closed on exit")
	}
}

type fakeReadResult struct {
	n       int
	payload []byte
	err     error
}

type fakeHIDDevice struct {
	mu          sync.Mutex
	readResults chan fakeReadResult
	writes      [][]byte
	closed      bool
}

func (f *fakeHIDDevice) ReadWithTimeout(p []byte, timeout time.Duration) (int, error) {
	if f.readResults == nil {
		time.Sleep(timeout)
		return 0, hid.ErrTimeout
	}

	select {
	case result := <-f.readResults:
		if result.err != nil {
			return 0, result.err
		}
		copy(p, result.payload)
		return result.n, nil
	case <-time.After(timeout):
		return 0, hid.ErrTimeout
	}
}

func (f *fakeHIDDevice) SendFeatureReport(p []byte) (int, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	cp := append([]byte(nil), p...)
	f.writes = append(f.writes, cp)
	return len(p), nil
}

func (f *fakeHIDDevice) Close() error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.closed = true
	return nil
}

func waitForEvent(t *testing.T, events <-chan BravoEvent) BravoEvent {
	t.Helper()

	select {
	case event := <-events:
		return event
	case <-time.After(250 * time.Millisecond):
		t.Fatal("timed out waiting for Bravo event")
		return BravoEvent{}
	}
}
