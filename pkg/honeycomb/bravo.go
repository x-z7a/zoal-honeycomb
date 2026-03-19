package honeycomb

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/sstallion/go-hid"
	"github.com/x-z7a/zoal-honeycomb/pkg"
)

var Vendor uint16 = 0x294B
var Product uint16 = 0x1901

const (
	bravoLEDReportSize  = 65
	bravoEventBufferLen = 256
)

type BravoService interface {
	Events() <-chan BravoEvent
	Exit()
}

type hidDevice interface {
	ReadWithTimeout(p []byte, timeout time.Duration) (int, error)
	SendFeatureReport(p []byte) (int, error)
	Close() error
}

type bravoService struct {
	Logger pkg.Logger

	ctx        context.Context
	cancelFunc context.CancelFunc
	wg         sync.WaitGroup

	events chan BravoEvent

	hidReportBuffer []byte
	openDevice      func() (hidDevice, error)
	hidExit         func() error
	readTimeout     time.Duration
	reconnectDelay  time.Duration
}

func (b *bravoService) Events() <-chan BravoEvent {
	return b.events
}

func (b *bravoService) Exit() {
	b.cancelFunc()
	b.wg.Wait()

	if b.hidExit != nil {
		if err := b.hidExit(); err != nil {
			b.Logger.Errorf("failed to exit hidapi: %v", err)
		}
	}
}

func (b *bravoService) run() {
	defer b.wg.Done()
	defer close(b.events)

	decoder := newInputDecoder()
	inputReport := make([]byte, bravoInputReportSize)
	var device hidDevice

	closeDevice := func() {
		if device == nil {
			return
		}
		if err := device.Close(); err != nil {
			b.Logger.Errorf("failed to close device: %v", err)
		}
		device = nil
		decoder.Reset()
	}
	defer closeDevice()

	for {
		select {
		case <-b.ctx.Done():
			b.flushLEDs(device, true)
			return
		default:
		}

		if device == nil {
			nextDevice, err := b.openDevice()
			if err != nil || nextDevice == nil {
				b.Logger.Debugf("waiting for Bravo HID device: %v", err)
				if !sleepWithContext(b.ctx, b.reconnectDelay) {
					return
				}
				continue
			}
			device = nextDevice
			b.Logger.Info("Bravo HID device connected")
		}

		n, err := device.ReadWithTimeout(inputReport, b.readTimeout)
		if err != nil && !errors.Is(err, hid.ErrTimeout) {
			b.Logger.Errorf("failed to read Bravo input report: %v", err)
			closeDevice()
			if !sleepWithContext(b.ctx, b.reconnectDelay) {
				return
			}
			continue
		}

		if n > 0 {
			events, decodeErr := decoder.Decode(inputReport[:n])
			if decodeErr != nil {
				b.Logger.Errorf("failed to decode Bravo input report: %v", decodeErr)
			} else {
				for _, event := range events {
					select {
					case <-b.ctx.Done():
						b.flushLEDs(device, true)
						return
					case b.events <- event:
					}
				}
			}
		}

		if err := b.flushLEDs(device, false); err != nil {
			b.Logger.Errorf("failed to flush Bravo LED state: %v", err)
			closeDevice()
			if !sleepWithContext(b.ctx, b.reconnectDelay) {
				return
			}
		}
	}
}

func (b *bravoService) flushLEDs(device hidDevice, forceOff bool) error {
	if device == nil {
		return nil
	}

	LED_STATE_CHANGED_LOCK.Lock()
	ledStateChanged := LED_STATE_CHANGED
	if forceOff {
		ANUNCIATOR_W2 = 0
		ANUNCIATOR_W1 = 0
		LANDING_GEAR_W = 0
		AUTO_PILOT_W = 0
		ledStateChanged = true
	}
	if !ledStateChanged {
		LED_STATE_CHANGED_LOCK.Unlock()
		return nil
	}

	b.hidReportBuffer[0] = 0x0
	b.hidReportBuffer[1] = AUTO_PILOT_W
	b.hidReportBuffer[2] = LANDING_GEAR_W
	b.hidReportBuffer[3] = ANUNCIATOR_W1
	b.hidReportBuffer[4] = ANUNCIATOR_W2
	for i := 5; i < len(b.hidReportBuffer); i++ {
		b.hidReportBuffer[i] = 0
	}
	LED_STATE_CHANGED = false
	LED_STATE_CHANGED_LOCK.Unlock()

	b.Logger.Debugf("LED_STATE_CHANGED: %v", ledStateChanged)
	b.DebugPrintLEDStates()

	written, err := device.SendFeatureReport(b.hidReportBuffer)
	if err != nil {
		UpdateLEDStateChanged(true)
		return err
	}
	b.Logger.Debugf("bytes written: %d", written)
	if written != bravoLEDReportSize {
		UpdateLEDStateChanged(true)
	}

	return nil
}

func sleepWithContext(ctx context.Context, duration time.Duration) bool {
	timer := time.NewTimer(duration)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}

var bravoSvcLock = &sync.Mutex{}
var bravoSvc BravoService

func NewBravoService(logger pkg.Logger) BravoService {
	if bravoSvc != nil {
		logger.Info("Bravo SVC has been initialized already")
		return bravoSvc
	}

	logger.Info("Bravo SVC: initializing")
	bravoSvcLock.Lock()
	defer bravoSvcLock.Unlock()

	if bravoSvc != nil {
		logger.Info("Bravo SVC has been initialized already")
		return bravoSvc
	}

	ctx, cancel := context.WithCancel(context.Background())
	svc := &bravoService{
		Logger:          logger,
		ctx:             ctx,
		cancelFunc:      cancel,
		events:          make(chan BravoEvent, bravoEventBufferLen),
		hidReportBuffer: make([]byte, bravoLEDReportSize),
		openDevice: func() (hidDevice, error) {
			return hid.OpenFirst(Vendor, Product)
		},
		readTimeout:    50 * time.Millisecond,
		reconnectDelay: time.Second,
	}

	if err := hid.Init(); err != nil {
		logger.Errorf("failed to initialize hidapi: %v", err)
		close(svc.events)
		bravoSvc = svc
		return bravoSvc
	}
	configureHIDOpenMode()
	svc.hidExit = hid.Exit

	svc.wg.Add(1)
	go svc.run()

	bravoSvc = svc
	return bravoSvc
}
