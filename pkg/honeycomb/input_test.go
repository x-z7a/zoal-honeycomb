package honeycomb

import "testing"

func TestInputDecoderEmitsButtonReleaseEvents(t *testing.T) {
	decoder := newInputDecoder()

	initial := testReport(bravoSelectorHDG, bravoButtonHDG)
	events, err := decoder.Decode(initial)
	if err != nil {
		t.Fatalf("Decode returned error: %v", err)
	}
	if len(events) != 1 || events[0].Kind != BravoEventSelector || events[0].Name != "hdg" {
		t.Fatalf("expected initial selector event, got %#v", events)
	}

	events, err = decoder.Decode(testReport(bravoSelectorHDG))
	if err != nil {
		t.Fatalf("Decode returned error: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(events))
	}
	if events[0].Kind != BravoEventButton || events[0].Name != "hdg" {
		t.Fatalf("expected HDG button release, got %#v", events[0])
	}
}

func TestInputDecoderEmitsSelectorOnlyOnChange(t *testing.T) {
	decoder := newInputDecoder()

	events, err := decoder.Decode(testReport(bravoSelectorIAS))
	if err != nil {
		t.Fatalf("Decode returned error: %v", err)
	}
	if len(events) != 1 || events[0].Name != "ias" {
		t.Fatalf("expected initial IAS selector event, got %#v", events)
	}

	events, err = decoder.Decode(testReport(bravoSelectorIAS))
	if err != nil {
		t.Fatalf("Decode returned error: %v", err)
	}
	if len(events) != 0 {
		t.Fatalf("expected no duplicate selector event, got %#v", events)
	}

	events, err = decoder.Decode(testReport(bravoSelectorVS))
	if err != nil {
		t.Fatalf("Decode returned error: %v", err)
	}
	if len(events) != 1 || events[0].Kind != BravoEventSelector || events[0].Name != "vs" {
		t.Fatalf("expected VS selector change, got %#v", events)
	}
}

func TestInputDecoderEmitsEncoderDeltas(t *testing.T) {
	decoder := newInputDecoder()

	if _, err := decoder.Decode(testReport(bravoSelectorHDG)); err != nil {
		t.Fatalf("Decode returned error: %v", err)
	}

	events, err := decoder.Decode(testReport(bravoSelectorHDG, bravoButtonEncoderUp))
	if err != nil {
		t.Fatalf("Decode returned error: %v", err)
	}
	if len(events) != 1 || events[0].Kind != BravoEventEncoder || events[0].Delta != 1 {
		t.Fatalf("expected encoder up event, got %#v", events)
	}

	events, err = decoder.Decode(testReport(bravoSelectorHDG, bravoButtonEncoderUp))
	if err != nil {
		t.Fatalf("Decode returned error: %v", err)
	}
	if len(events) != 0 {
		t.Fatalf("expected no duplicate encoder event while held, got %#v", events)
	}

	if _, err := decoder.Decode(testReport(bravoSelectorHDG)); err != nil {
		t.Fatalf("Decode returned error: %v", err)
	}

	events, err = decoder.Decode(testReport(bravoSelectorHDG, bravoButtonEncoderDown))
	if err != nil {
		t.Fatalf("Decode returned error: %v", err)
	}
	if len(events) != 1 || events[0].Kind != BravoEventEncoder || events[0].Delta != -1 {
		t.Fatalf("expected encoder down event, got %#v", events)
	}
}

func TestInputDecoderEmitsTrimDeltas(t *testing.T) {
	decoder := newInputDecoder()

	if _, err := decoder.Decode(testReport(bravoSelectorALT)); err != nil {
		t.Fatalf("Decode returned error: %v", err)
	}

	events, err := decoder.Decode(testReport(bravoSelectorALT, bravoButtonTrimUp))
	if err != nil {
		t.Fatalf("Decode returned error: %v", err)
	}
	if len(events) != 1 || events[0].Kind != BravoEventTrim || events[0].Delta != 1 {
		t.Fatalf("expected trim up event, got %#v", events)
	}

	if _, err := decoder.Decode(testReport(bravoSelectorALT)); err != nil {
		t.Fatalf("Decode returned error: %v", err)
	}

	events, err = decoder.Decode(testReport(bravoSelectorALT, bravoButtonTrimDown))
	if err != nil {
		t.Fatalf("Decode returned error: %v", err)
	}
	if len(events) != 1 || events[0].Kind != BravoEventTrim || events[0].Delta != -1 {
		t.Fatalf("expected trim down event, got %#v", events)
	}
}

func TestInputDecoderIgnoresRepeatedIdenticalReports(t *testing.T) {
	decoder := newInputDecoder()
	report := testReport(bravoSelectorCRS)

	if _, err := decoder.Decode(report); err != nil {
		t.Fatalf("Decode returned error: %v", err)
	}

	events, err := decoder.Decode(report)
	if err != nil {
		t.Fatalf("Decode returned error: %v", err)
	}
	if len(events) != 0 {
		t.Fatalf("expected no events for identical report, got %#v", events)
	}
}

func TestInputDecoderHasChangedTracksLatestDecodedReport(t *testing.T) {
	decoder := newInputDecoder()
	initial := testReport(bravoSelectorIAS)
	changed := testReport(bravoSelectorALT)

	if !decoder.HasChanged(initial) {
		t.Fatal("expected first report to be treated as changed")
	}

	if _, err := decoder.Decode(initial); err != nil {
		t.Fatalf("Decode returned error: %v", err)
	}

	if decoder.HasChanged(initial) {
		t.Fatal("expected identical report not to be treated as changed after decode")
	}

	if !decoder.HasChanged(changed) {
		t.Fatal("expected different report to be treated as changed")
	}
}

func TestInputDecoderIgnoresFlapReports(t *testing.T) {
	decoder := newInputDecoder()
	baseline := testReport(10, 11, 21, 25, 28, 32, 35, 37, 39, 40, 42, 44, 47)
	flapDown := testReport(10, 11, 15, 21, 25, 28, 32, 35, 37, 39, 40, 42, 44, 47)
	flapUp := testReport(10, 11, 16, 21, 25, 28, 32, 35, 37, 39, 40, 42, 44, 47)

	events, err := decoder.Decode(baseline)
	if err != nil {
		t.Fatalf("Decode returned error: %v", err)
	}
	if len(events) != 1 || events[0].Kind != BravoEventSelector || events[0].Name != "alt" {
		t.Fatalf("expected initial ALT selector event, got %#v", events)
	}

	events, err = decoder.Decode(flapDown)
	if err != nil {
		t.Fatalf("Decode returned error: %v", err)
	}
	if len(events) != 0 {
		t.Fatalf("expected flap-down report to be ignored, got %#v", events)
	}

	if _, err := decoder.Decode(baseline); err != nil {
		t.Fatalf("Decode returned error: %v", err)
	}

	events, err = decoder.Decode(flapUp)
	if err != nil {
		t.Fatalf("Decode returned error: %v", err)
	}
	if len(events) != 0 {
		t.Fatalf("expected flap-up report to be ignored, got %#v", events)
	}
}

func TestSelectorBitsDoNotAliasTrimBits(t *testing.T) {
	report := make([]byte, bravoInputReportSize)

	setTestButton(report, bravoSelectorCRS, true)

	if !buttonPressed(report, bravoSelectorCRS) {
		t.Fatalf("expected CRS selector bit to be set")
	}
	if buttonPressed(report, bravoButtonTrimUp) {
		t.Fatalf("expected CRS selector bit not to alias trim up")
	}
	if buttonPressed(report, bravoButtonTrimDown) {
		t.Fatalf("expected CRS selector bit not to alias trim down")
	}
}

func testReport(pressedButtons ...int) []byte {
	report := make([]byte, bravoInputReportSize)
	for _, button := range pressedButtons {
		setTestButton(report, button, true)
	}
	return report
}

func setTestButton(report []byte, button int, pressed bool) {
	bit := button - 1
	byteIndex := bravoInputButtonOffset + (bit / 8)
	mask := byte(1 << (bit % 8))
	if pressed {
		report[byteIndex] |= mask
		return
	}
	report[byteIndex] &^= mask
}
