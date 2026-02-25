package xplane

import (
	"fmt"
	"os"
	"path"
	"strings"

	"github.com/expr-lang/expr"
	"github.com/xairline/goplane/xplm/dataAccess"
	"github.com/xairline/goplane/xplm/menus"
	"github.com/xairline/goplane/xplm/utilities"
	"github.com/xairline/xa-honeycomb/pkg"
	"gopkg.in/yaml.v3"
)

func (s *xplaneService) tryLoadProfile() error {
	defer func() error {
		if r := recover(); r != nil {
			s.Logger.Errorf("Recovered from panic: %v", r)
			return fmt.Errorf("recovered from panic: %v", r)
		}
		return nil
	}()

	// Try to load profiles using the aircraft's ICAO
	aircraftIACODrf, found := dataAccess.FindDataRef("sim/aircraft/view/acf_ICAO")
	if found {
		var planeProfile pkg.Profile
		aircraftIACO := dataAccess.GetString(aircraftIACODrf)
		// Try to load the profile using the aircraft's ICAO
		planeProfile, err := s.loadProfile(aircraftIACO)
		if err != nil {
			// there is no profile for the aircraft
			// we use default profile
			s.Logger.Warningf("Cannot loading BravoProfile for %s: %v, using default", aircraftIACO, err)
			planeProfile, err = s.loadProfile("default")
		}

		// try to load other profiles for this aircraft
		aircraftNameDrf, found := dataAccess.FindDataRef("sim/aircraft/view/acf_ui_name")
		if found {
			aircraftName := dataAccess.GetString(aircraftNameDrf)
			configFilePath := path.Join(s.pluginPath, "profiles")
			entries, err := os.ReadDir(configFilePath)
			if err != nil {
				s.Logger.Errorf("Error reading profiles folder: %v", err)
				return err
			}
			for _, entry := range entries {
				if !entry.IsDir() && path.Ext(entry.Name()) == ".yaml" && strings.HasPrefix(entry.Name(), aircraftIACO) {
					s.Logger.Infof("Checking profile: %s", entry.Name())
					profile, err := s.loadProfile(strings.Replace(entry.Name(), ".yaml", "", 1))
					if err != nil {
						s.Logger.Errorf("Error loading profile %s: %v", entry.Name(), err)
					}
					for _, selector := range profile.Metadata.Selectors {
						if selector == aircraftName {
							planeProfile = profile
							break
						} else {
							s.Logger.Infof("Skipping profile %s for %s, ui name: %s", entry.Name(), selector, aircraftName)
						}
					}
				}
			}
		}
		s.Logger.Infof("Loaded profile: %s", planeProfile.Metadata.Name)
		menus.SetMenuItemName(s.myMenuId, 0, fmt.Sprintf("Reload Profile (Current: %s)", planeProfile.Metadata.Name), true)
		if planeProfile.Metadata.Name == "Default" {
			utilities.SpeakString("Warning! No Plane specific profile found! Using default profile!")
		}
		return s.setupProfile(planeProfile)
	}
	return nil
}

func (s *xplaneService) setupProfile(planeProfile pkg.Profile) error {
	// Fill in any missing sections of the profile
	if planeProfile.Metadata == nil {
		planeProfile.Metadata = &pkg.Metadata{}
	}
	if planeProfile.Data == nil {
		planeProfile.Data = &pkg.Data{}
	}
	if planeProfile.Conditions == nil {
		planeProfile.Conditions = &pkg.Conditions{}
	}
	if planeProfile.Knobs == nil {
		planeProfile.Knobs = &pkg.Knobs{}
	}
	if planeProfile.Leds == nil {
		planeProfile.Leds = &pkg.Leds{}
	}

	var err error
	hasErrors := false

	s.Logger.Infof("Loading LEDs")
	err = rangeStruct(planeProfile.Leds, s.loadProfileElement)
	if err != nil {
		s.Logger.Errorf("Error loading LEDs: %v", err)
		hasErrors = true
	}

	s.Logger.Infof("Loading Datas")
	err = rangeStruct(planeProfile.Data, s.loadProfileElement)
	if err != nil {
		s.Logger.Errorf("Error loading Datas: %v", err)
		hasErrors = true
	}

	s.Logger.Infof("Loading Knobs")
	err = rangeStruct(planeProfile.Knobs, s.loadProfileElement)
	if err != nil {
		s.Logger.Errorf("Error loading Knobs: %v", err)
		hasErrors = true
	}

	s.Logger.Infof("Loading Conditions")
	err = rangeStruct(planeProfile.Conditions, s.loadProfileElement)
	if err != nil {
		s.Logger.Errorf("Error loading Conditions: %v", err)
		hasErrors = true
	}

	if hasErrors {
		s.Logger.Infof("Loaded profile with errors")
	} else {
		s.Logger.Infof("Successfully loaded profile")
	}
	s.profile = &planeProfile
	if hasErrors {
		return fmt.Errorf("Loaded profile with errors")
	} else {
		return nil
	}
}

func (s *xplaneService) loadProfile(airplaneConfig string) (pkg.Profile, error) {
	// load datarefs for the airplane from YAML
	configFilePath := path.Join(s.pluginPath, "profiles", fmt.Sprintf("%s.yaml", airplaneConfig))
	f, err := os.ReadFile(configFilePath)
	if err != nil {
		return pkg.Profile{}, err
	}
	s.Logger.Infof("Loading datarefs from: %s", configFilePath)
	var res pkg.Profile
	err = yaml.Unmarshal(f, &res)
	if err != nil {
		return pkg.Profile{}, err
	}
	return res, nil
}

func (s *xplaneService) loadDatarefProfile(fieldName string, fieldValue *pkg.DatarefProfile) error {
	if fieldValue.Datarefs != nil {
		for j := range fieldValue.Datarefs {
			dataref := &fieldValue.Datarefs[j]
			dataref.Dataref = s.getDataref(dataref.DatarefStr)
		}
	} else {
		s.Logger.Infof("---- No datarefs specified for %s", fieldName)
	}
	return nil
}

func (s *xplaneService) loadConditionProfile(fieldName string, fieldValue *pkg.ConditionProfile) error {
	if fieldValue.Datarefs == nil {
		s.Logger.Infof("---- No datarefs specified")
		return nil
	}

	for j := range fieldValue.Datarefs {
		dataref := &fieldValue.Datarefs[j]
		myDataref := s.getDataref(dataref.DatarefStr)

		if myDataref == nil {
			continue
		}

		dataref.Dataref = myDataref
		datarefType := dataAccess.GetDataRefTypes(myDataref)

		if dataref.Operator != "" {
			if !isOperatorSupported(dataref.Operator) {
				return fmt.Errorf("Unsupported operator found: %s", dataref.Operator)
			}

			var code string
			if datarefType&dataAccess.TypeFloat > 0 {
				code = fmt.Sprintf("GetFloatData(myDataref) %s %f", dataref.Operator, dataref.Threshold)
			} else if datarefType&dataAccess.TypeInt > 0 {
				code = fmt.Sprintf("GetIntData(myDataref) %s %d", dataref.Operator, int(dataref.Threshold))
			} else if datarefType&dataAccess.TypeFloatArray > 0 {
				code = fmt.Sprintf("GetFloatArrayData(myDataref)[%d] %s %f", dataref.Index, dataref.Operator, dataref.Threshold)
			} else if datarefType&dataAccess.TypeIntArray > 0 {
				code = fmt.Sprintf("GetIntArrayData(myDataref)[%d] %s %d", dataref.Index, dataref.Operator, int(dataref.Threshold))
			} else if datarefType&dataAccess.TypeDouble > 0 {
				code = fmt.Sprintf("GetDoubleData(myDataref) %s %f", dataref.Operator, dataref.Threshold)
			} else {
				return fmt.Errorf("Dataref type not supported: %v", datarefType)
			}

			s.Logger.Infof("---- Compiling expression: %s - %s[%d]: %s", code, fieldName, j, dataref.DatarefStr)
			env := map[string]interface{}{
				"GetFloatData":      dataAccess.GetFloatData,
				"GetIntData":        dataAccess.GetIntData,
				"GetFloatArrayData": dataAccess.GetFloatArrayData,
				"GetIntArrayData":   dataAccess.GetIntArrayData,
				"GetDoubleData":     dataAccess.GetDoubleData,
				"myDataref":         myDataref,
			}
			program, err := expr.Compile(code, expr.Env(env))
			if err != nil {
				return fmt.Errorf("Error compiling expression: %v", err)
			}
			dataref.Expr = program
			dataref.Env = env
		} else {
			return fmt.Errorf("Condition missing operator: %s", fieldName)
		}
	}

	s.Logger.Infof("-- Rules compiled successfully for: %s", fieldName)
	return nil
}

func (s *xplaneService) loadLedProfile(fieldName string, fieldValue *pkg.LEDProfile) error {
	err := s.loadConditionProfile(fieldName, &fieldValue.ConditionProfile)

	fieldValue.On, fieldValue.Off = s.assignOnAndOffFuncs(fieldName)
	return err
}

func (s *xplaneService) loadProfileElement(fieldName string, value interface{}) (interface{}, error) {
	dataProfileValue, ok := value.(pkg.DataProfile)
	if ok {
		s.Logger.Infof("-- Loading Data: %s", fieldName)
		err := s.loadDatarefProfile(fieldName, &dataProfileValue.DatarefProfile)
		return dataProfileValue, err
	}

	knobProfileValue, ok := value.(pkg.KnobProfile)
	if ok {
		s.Logger.Infof("-- Loading Knob: %s", fieldName)
		err := s.loadDatarefProfile(fieldName, &knobProfileValue.DatarefProfile)
		return knobProfileValue, err
	}

	conditionProfileValue, ok := value.(pkg.ConditionProfile)
	if ok {
		s.Logger.Infof("-- Loading Condition: %s", fieldName)
		err := s.loadConditionProfile(fieldName, &conditionProfileValue)
		return conditionProfileValue, err
	}

	ledProfileValue, ok := value.(pkg.LEDProfile)
	if ok {
		s.Logger.Infof("-- Loading LED: %s", fieldName)
		err := s.loadLedProfile(fieldName, &ledProfileValue)
		return ledProfileValue, err
	}

	return value, fmt.Errorf("Field %s is not of a known type", fieldName)
}
