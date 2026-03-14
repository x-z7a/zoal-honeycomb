package honeycomb

import (
	"context"
	"sync"
	"time"

	"github.com/sstallion/go-hid"
	"github.com/x-z7a/zoal-honeycomb/pkg"
	"github.com/xairline/goplane/xplm/utilities"
)

var Vendor uint16 = 0x294B
var Product uint16 = 0x1901
var BRAVO_CONNECTED = true
var PROFILE_LOADED = false

type BravoService interface {
	UpdateLeds()
	Exit()
}

type bravoService struct {
	Logger pkg.Logger
	ctx    context.Context

	hidReportBuffer []byte
	cancelFunc      context.CancelFunc
}

func (b *bravoService) UpdateLeds() {

	go func() {
		for {
			select {
			case <-b.ctx.Done():
				b.Logger.Infof("UpdateLeds: Context canceled, exiting goroutine")
				return
			default:
				if BRAVO_CONNECTED == false || PROFILE_LOADED == false {
					continue
				}
				LED_STATE_CHANGED_LOCK.Lock()
				ledStateChanged := LED_STATE_CHANGED
				LED_STATE_CHANGED = false
				LED_STATE_CHANGED_LOCK.Unlock()

				if ledStateChanged {
					b.Logger.Debugf("LED_STATE_CHANGED: %v", LED_STATE_CHANGED)
					b.DebugPrintLEDStates()
					b.hidReportBuffer[0] = 0x0
					b.hidReportBuffer[1] = AUTO_PILOT_W
					b.hidReportBuffer[2] = LANDING_GEAR_W
					b.hidReportBuffer[3] = ANUNCIATOR_W1
					b.hidReportBuffer[4] = ANUNCIATOR_W2
					bravo, err := hid.OpenFirst(Vendor, Product)
					if err != nil || bravo == nil {
						b.Logger.Errorf("failed to open device: %v", err)
						continue
					}
					x, err := bravo.SendFeatureReport(b.hidReportBuffer)
					if err != nil {
						b.Logger.Errorf("failed to write to device: %v", err)
						b.Logger.Infof("bytes written: %d", x)
					}
					b.Logger.Debugf("bytes written: %d", x)
					if x != 65 {
						LED_STATE_CHANGED_LOCK.Lock()
						LED_STATE_CHANGED = true
						LED_STATE_CHANGED_LOCK.Unlock()
					}
					bravo.Close()
					time.Sleep(100 * time.Millisecond) // Simulated delay
				}
			}
		}
	}()
}

func (b *bravoService) Exit() {
	if BRAVO_CONNECTED == false {
		return
	}
	b.cancelFunc()

	b.hidReportBuffer[0] = 0x0
	b.hidReportBuffer[1] = 0x0
	b.hidReportBuffer[2] = 0x0
	b.hidReportBuffer[3] = 0x0
	b.hidReportBuffer[4] = 0x0
	bravo, err := hid.OpenFirst(Vendor, Product)
	if err != nil {
		b.Logger.Errorf("failed to open device: %v", err)
	}
	if x, err := bravo.SendFeatureReport(b.hidReportBuffer); err != nil {
		b.Logger.Errorf("failed to write to device: %v", err)
		b.Logger.Infof("bytes written: %d", x)
	}

	if err := bravo.Close(); err != nil {
		b.Logger.Errorf("failed to close device: %v", err)
	}
	if err := hid.Exit(); err != nil {
		b.Logger.Errorf("failed to exit hidapi: %v", err)
	}
}

var bravoSvcLock = &sync.Mutex{}
var bravoSvc BravoService

func NewBravoService(logger pkg.Logger) BravoService {
	if bravoSvc != nil {
		logger.Info("Bravo SVC has been initialized already")
		return bravoSvc
	} else {
		logger.Info("Bravo SVC: initializing")
		bravoSvcLock.Lock()
		defer bravoSvcLock.Unlock()

		if err := hid.Init(); err != nil {
			logger.Errorf("failed to initialize hidapi: %v", err)
			return nil
		}

		ctx, cancel := context.WithCancel(context.Background())
		bravoSvc = &bravoService{
			Logger:          logger,
			ctx:             ctx,
			hidReportBuffer: make([]byte, 65),
			cancelFunc:      cancel,
		}

		bravo, err := hid.OpenFirst(Vendor, Product)
		if err != nil || bravo == nil {
			logger.Errorf("failed to open device: %v", err)
			utilities.SpeakString("Bravo device not found")
			BRAVO_CONNECTED = false
		}
		if bravo != nil {
			bravo.Close()
		}

		bravoSvc.UpdateLeds()
		return bravoSvc
	}
}
