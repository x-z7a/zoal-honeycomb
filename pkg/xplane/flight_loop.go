package xplane

import (
	"reflect"

	"github.com/x-z7a/zoal-honeycomb/pkg"
	"github.com/x-z7a/zoal-honeycomb/pkg/honeycomb"
	"github.com/xairline/goplane/xplm/dataAccess"
)

const (
	defaultFlightLoopInterval = float32(0.1)
	activeTrimFlightLoopDelay = float32(0.02)
)

// flightLoop is called periodically. You return 0.1, meaning it runs every ~100ms
func (s *xplaneService) flightLoop(
	elapsedSinceLastCall,
	elapsedTimeSinceLastFlightLoop float32,
	counter int,
	ref interface{},
) float32 {
	if s.profile == nil {
		s.Logger.Info("Profile is nil, try to load it again")
		s.lastCounter = 0
		err := s.tryLoadProfile()
		if err != nil {
			s.stopTrimCommand()
			s.resetTrimCadence()
			s.profile = nil
			return 1
		}

	}

	// Bump global time by elapsed since last call
	s.globalTime += float64(elapsedSinceLastCall)

	if counter-s.lastCounter > 200 {
		honeycomb.LED_STATE_CHANGED_LOCK.Lock()
		honeycomb.LED_STATE_CHANGED = true
		honeycomb.LED_STATE_CHANGED_LOCK.Unlock()
		s.lastCounter = counter
	}

	s.drainBravoEvents()
	s.updateTrimCommandState()
	s.updateLeds()

	s.cmdEventQueueMu.Lock()
	queuedCommands := s.cmdEventQueue
	s.cmdEventQueue = []string{}
	s.cmdEventQueueMu.Unlock()

	// Process new command events:
	for _, cmdStr := range queuedCommands {
		// Start the command if it's not already active
		if _, exists := s.commandStates[cmdStr]; !exists {
			if !s.beginCommandSignal(cmdStr) {
				continue
			}
			s.commandStates[cmdStr] = &commandState{
				startTime: s.globalTime,
				active:    true,
			}
		} else {
			// If this command is already active, either handle it differently
			// or log a message. Typically you'd want one begin/end cycle at a time.
			s.commandStates[cmdStr].startTime = -9999
			s.Logger.Warningf("Command %s is already active.", cmdStr)
		}
	}

	// End commands that have been held for at least 200ms
	for cmdStr, state := range s.commandStates {
		if state.active && (s.globalTime-state.startTime) >= 0.2 {
			s.endCommandSignal(cmdStr)
			delete(s.commandStates, cmdStr)
		}
	}

	if s.trimActive {
		return activeTrimFlightLoopDelay
	}

	return defaultFlightLoopInterval
}

func (s *xplaneService) updateLeds() {
	if s.profile == nil {
		return
	}

	// special case for bus voltage
	busVoltage, busVoltageOK := s.evaluateCondition(&s.profile.Conditions.BUS_VOLTAGE)
	if busVoltageOK && !busVoltage {
		honeycomb.AllOff()
		return
	}

	val := reflect.ValueOf(s.profile.Leds).Elem() // Get the actual struct value
	typ := val.Type()
	for i := 0; i < val.NumField(); i++ {
		field := typ.Field(i) // Get the field metadata
		fieldName := field.Name
		// Get the field value as a reflect.Value
		fieldVal := val.Field(i)
		// Perform type assertion to BravoProfile
		fieldValue, ok := fieldVal.Interface().(pkg.LEDProfile)
		if !ok {
			s.Logger.Errorf("Field %s is not of type LEDProfile", fieldName)
			continue
		}

		if fieldValue.Datarefs == nil {
			continue
		}

		if fieldName == "GEAR" {
			// special case for gear
			retractableGear, retractableGearOK := s.evaluateCondition(&s.profile.Conditions.RETRACTABLE_GEAR)
			if retractableGearOK && !retractableGear {
				s.updateGearLEDs([]float32{0, 0, 0})
				continue
			}

			dataref := s.profile.Leds.GEAR.Datarefs[0]
			if dataref.Dataref != nil {
				output := dataAccess.GetFloatArrayData(dataref.Dataref.(dataAccess.DataRef))
				s.updateGearLEDs(output)
			}
			continue
		}

		result, resultOK := s.evaluateCondition(&fieldValue.ConditionProfile)
		if resultOK {
			if result {
				fieldValue.On()
			} else {
				fieldValue.Off()
			}
		} else {
			s.Logger.Errorf("Condition not OK for LED: %s", fieldName)
		}
	}
}

func (s *xplaneService) updateGearLEDs(output []float32) {
	if output[0] >= 0.99 {
		honeycomb.OnLEDNoseGearGreen()
		honeycomb.OffLEDNoseGearRed()
	}
	if output[0] <= 0.01 {
		honeycomb.OffLEDNoseGearGreen()
		honeycomb.OffLEDNoseGearRed()
	}
	if output[0] > 0.01 && output[0] < 0.99 {
		honeycomb.OffLEDNoseGearGreen()
		honeycomb.OnLEDNoseGearRed()
	}

	if output[1] >= 0.99 {
		honeycomb.OnLEDLeftGearGreen()
		honeycomb.OffLEDLeftGearRed()
	}
	if output[1] <= 0.01 {
		honeycomb.OffLEDLeftGearGreen()
		honeycomb.OffLEDLeftGearRed()
	}
	if output[1] > 0.01 && output[1] < 0.99 {
		honeycomb.OffLEDLeftGearGreen()
		honeycomb.OnLEDLeftGearRed()
	}

	if s.profile.Metadata.Name != "Flight Factor B772" {
		if output[2] >= 0.99 {
			honeycomb.OnLEDRightGearGreen()
			honeycomb.OffLEDRightGearRed()
		}
		if output[2] <= 0.01 {
			honeycomb.OffLEDRightGearGreen()
			honeycomb.OffLEDRightGearRed()
		}
		if output[2] > 0.01 && output[2] < 0.99 {
			honeycomb.OffLEDRightGearGreen()
			honeycomb.OnLEDRightGearRed()
		}
	} else {
		if output[3] >= 0.99 {
			honeycomb.OnLEDRightGearGreen()
			honeycomb.OffLEDRightGearRed()
		}
		if output[3] <= 0.01 {
			honeycomb.OffLEDRightGearGreen()
			honeycomb.OffLEDRightGearRed()
		}
		if output[3] > 0.01 && output[3] < 0.99 {
			honeycomb.OffLEDRightGearGreen()
			honeycomb.OnLEDRightGearRed()
		}
	}

}

func (s *xplaneService) drainBravoEvents() {
	if s.BravoService == nil {
		return
	}

	events := s.BravoService.Events()
	if events == nil {
		return
	}

	for {
		select {
		case event, ok := <-events:
			if !ok {
				return
			}
			s.handleBravoEvent(event)
		default:
			return
		}
	}
}
