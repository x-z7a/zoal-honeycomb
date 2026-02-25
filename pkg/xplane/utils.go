package xplane

import (
	"reflect"

	"github.com/expr-lang/expr"
	"github.com/xairline/goplane/xplm/dataAccess"
	"github.com/xairline/xa-honeycomb/pkg"
	"github.com/xairline/xa-honeycomb/pkg/honeycomb"
)

func (s *xplaneService) assignOnAndOffFuncs(name string) (func(), func()) {
	switch name {
	case "APR":
		return honeycomb.OnLEDAPR, honeycomb.OffLEDAPR
	case "ALT":
		return honeycomb.OnLEDAlt, honeycomb.OffLEDAlt
	case "VS":
		return honeycomb.OnLEDVS, honeycomb.OffLEDVS
	case "HDG":
		return honeycomb.OnLEDHeading, honeycomb.OffLEDHeading
	case "NAV":
		return honeycomb.OnLEDNav, honeycomb.OffLEDNav
	case "REV":
		return honeycomb.OnLEDREV, honeycomb.OffLEDREV
	case "IAS":
		return honeycomb.OnLEDIAS, honeycomb.OffLEDIAS
	case "AP":
		return honeycomb.OnLEDAP, honeycomb.OffLEDAP
	case "BUS_VOLTAGE":
		return func() {
			return
		}, honeycomb.AllOff
	case "GEAR":
		return honeycomb.OnLedGearGreen, honeycomb.OnLedGearRed
	case "MASTER_WARN":
		return honeycomb.OnLEDMasterWarning, honeycomb.OffLEDMasterWarning
	case "MASTER_CAUTION":
		return honeycomb.OnLEDMasterCaution, honeycomb.OffLEDMasterCaution
	case "FIRE":
		return honeycomb.OnLEDEngineFire, honeycomb.OffLEDEngineFire
	case "VOLT_LOW":
		return honeycomb.OnLEDLowVolts, honeycomb.OffLEDLowVolts
	case "OIL_LOW_PRESSURE":
		return honeycomb.OnLEDLowOilPress, honeycomb.OffLEDLowOilPress
	case "FUEL_LOW_PRESSURE":
		return honeycomb.OnLEDLowFuelPress, honeycomb.OffLEDLowFuelPress
	case "ANTI_ICE":
		return honeycomb.OnLEDAntiIce, honeycomb.OffLEDAntiIce
	case "ENG_STARTER":
		return honeycomb.OnLEDStarter, honeycomb.OffLEDStarter
	case "APU":
		return honeycomb.OnLEDApu, honeycomb.OffLEDApu
	case "VACUUM":
		return honeycomb.OnLEDVacuum, honeycomb.OffLEDVacuum
	case "HYDRO_LOW_PRESSURE":
		return honeycomb.OnLEDLowHydPress, honeycomb.OffLEDLowHydPress
	case "PARKING_BRAKE":
		return honeycomb.OnLEDParkingBrake, honeycomb.OffLEDParkingBrake
	case "DOORS":
		return honeycomb.OnLEDDoor, honeycomb.OffLEDDoor
	case "AUX_FUEL_PUMP":
		return honeycomb.OnLEDFuelPump, honeycomb.OffLEDFuelPump
	default:
		s.Logger.Warningf("No on/off functions found for: %s", name)
		return nil, nil
	}
}

func rangeStruct(s interface{}, modify func(name string, value interface{}) (interface{}, error)) error {
	v := reflect.ValueOf(s)

	// Dereference to get the underlying struct
	v = v.Elem()
	t := v.Type()

	// Iterate over the fields
	for i := 0; i < v.NumField(); i++ {
		field := v.Field(i)
		fieldType := t.Field(i)

		value := field.Interface()
		newValue, err := modify(fieldType.Name, value)
		if err != nil {
			return err
		}
		field.Set(reflect.ValueOf(newValue))
	}
	return nil
}

func (s *xplaneService) getDataref(datarefStr string) dataAccess.DataRef {
	s.Logger.Infof("---- Finding dataref: %s", datarefStr)
	// Get a pointer to the actual element
	myDataref, found := dataAccess.FindDataRef(datarefStr)
	if !found {
		s.Logger.Errorf("Dataref not found: %s", datarefStr)
		return nil
	}

	return myDataref
}

// Check whether the given expression operator is allowed in our boolean expressions
// This prevents arbitrary code execution from user input.
func isOperatorSupported(operator string) bool {
	return operator == "==" ||
		operator == ">" ||
		operator == "<" ||
		operator == ">=" ||
		operator == "<=" ||
		operator == "!="
}

// Evaluate a condition
// Returns:
// 1. The result of the condition evaluation
// 2. Whether the condition was valid (if false then it should be ignored)
func (s *xplaneService) evaluateCondition(condition *pkg.ConditionProfile) (bool, bool) {
	var valid = false
	var result bool
	if condition.Condition == "any" {
		result = false
	} else {
		result = true
	}
	for _, dataref := range condition.Datarefs {
		if dataref.Expr == nil {
			continue
		}
		output, err := expr.Run(dataref.Expr, dataref.Env)
		if err != nil {
			s.Logger.Errorf("Error running expression: %v", err)
			continue
		}
		if condition.Condition == "any" {
			result = result || output.(bool)
		} else {
			// all or nothing (single value)
			result = result && output.(bool)
		}
		valid = true
	}
	return result, valid
}

// Extract a value from the given data profile
// Returns:
// 1. The value if found, or 0.0
// 2. Whether a value was found or not
func (s *xplaneService) dataValue(bp *pkg.DataProfile) (float64, bool) {
	if len(bp.Datarefs) > 0 {
		// TODO support something like "condition" that can aggregate multiple datarefs or array datarefs
		// e.g. "max" or "min" or "sum" or "avg"
		myDataref := bp.Datarefs[0]
		if myDataref.Dataref == nil {
			return 0.0, false
		}
		datarefType := dataAccess.GetDataRefTypes(myDataref.Dataref.(dataAccess.DataRef))
		if datarefType&dataAccess.TypeFloat > 0 {
			return float64(dataAccess.GetFloatData(myDataref.Dataref.(dataAccess.DataRef))), true
		} else if datarefType&dataAccess.TypeInt > 0 {
			return float64(dataAccess.GetIntData(myDataref.Dataref.(dataAccess.DataRef))), true
		} else if datarefType&dataAccess.TypeFloatArray > 0 {
			return float64(dataAccess.GetFloatArrayData(myDataref.Dataref.(dataAccess.DataRef))[0]), true
		} else if datarefType&dataAccess.TypeIntArray > 0 {
			return float64(dataAccess.GetIntArrayData(myDataref.Dataref.(dataAccess.DataRef))[0]), true
		} else if datarefType&dataAccess.TypeDouble > 0 {
			return dataAccess.GetDoubleData(myDataref.Dataref.(dataAccess.DataRef)), true
		} else {
			s.Logger.Errorf("Dataref type not supported: %v", datarefType)
			return 0.0, false
		}
	} else if bp.Value != nil {
		return float64(*bp.Value), true
	} else {
		return 0.0, false
	}
}
