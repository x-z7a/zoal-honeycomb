package honeycomb

import (
	"fmt"
	"strings"
)

const (
	bravoInputReportSize   = 18
	bravoInputButtonOffset = 12
)

const (
	bravoButtonHDG = 1 + iota
	bravoButtonNAV
	bravoButtonAPR
	bravoButtonREV
	bravoButtonALT
	bravoButtonVS
	bravoButtonIAS
	bravoButtonAP
)

const (
	bravoButtonEncoderUp   = 13
	bravoButtonEncoderDown = 14
)

const (
	bravoSelectorIAS = 17
	bravoSelectorCRS = 18
	bravoSelectorHDG = 19
	bravoSelectorVS  = 20
	bravoSelectorALT = 21
)

const (
	bravoButtonTrimDown = 22
	bravoButtonTrimUp   = 23
)

type BravoEventKind string

const (
	BravoEventButton   BravoEventKind = "button"
	BravoEventSelector BravoEventKind = "selector"
	BravoEventEncoder  BravoEventKind = "encoder"
	BravoEventTrim     BravoEventKind = "trim"
)

type BravoEvent struct {
	Kind  BravoEventKind
	Name  string
	Delta int
}

type inputDecoder struct {
	previous    [bravoInputReportSize]byte
	hasPrevious bool
	selector    string
}

type bravoButtonDescriptor struct {
	button int
	name   string
}

var bravoAPButtons = []bravoButtonDescriptor{
	{button: bravoButtonHDG, name: "hdg"},
	{button: bravoButtonNAV, name: "nav"},
	{button: bravoButtonAPR, name: "apr"},
	{button: bravoButtonREV, name: "rev"},
	{button: bravoButtonALT, name: "alt"},
	{button: bravoButtonVS, name: "vs"},
	{button: bravoButtonIAS, name: "ias"},
	{button: bravoButtonAP, name: "ap"},
}

var bravoSelectors = []bravoButtonDescriptor{
	{button: bravoSelectorIAS, name: "ias"},
	{button: bravoSelectorCRS, name: "crs"},
	{button: bravoSelectorHDG, name: "hdg"},
	{button: bravoSelectorVS, name: "vs"},
	{button: bravoSelectorALT, name: "alt"},
}

func newInputDecoder() *inputDecoder {
	return &inputDecoder{}
}

func (d *inputDecoder) Reset() {
	d.hasPrevious = false
	d.selector = ""
	d.previous = [bravoInputReportSize]byte{}
}

func (d *inputDecoder) HasChanged(report []byte) bool {
	if len(report) < bravoInputReportSize {
		return true
	}

	var current [bravoInputReportSize]byte
	copy(current[:], report[:bravoInputReportSize])

	if !d.hasPrevious {
		return true
	}

	return current != d.previous
}

func (d *inputDecoder) Decode(report []byte) ([]BravoEvent, error) {
	if len(report) < bravoInputReportSize {
		return nil, fmt.Errorf("expected at least %d bytes, got %d", bravoInputReportSize, len(report))
	}

	var current [bravoInputReportSize]byte
	copy(current[:], report[:bravoInputReportSize])

	currentSelector := selectorFromReport(current[:])
	if !d.hasPrevious {
		d.hasPrevious = true
		d.previous = current
		d.selector = currentSelector
		if currentSelector == "" {
			return nil, nil
		}
		return []BravoEvent{{
			Kind: BravoEventSelector,
			Name: currentSelector,
		}}, nil
	}

	events := make([]BravoEvent, 0, 4)

	for _, button := range bravoAPButtons {
		wasPressed := buttonPressed(d.previous[:], button.button)
		isPressed := buttonPressed(current[:], button.button)
		if wasPressed && !isPressed {
			events = append(events, BravoEvent{
				Kind: BravoEventButton,
				Name: button.name,
			})
		}
	}

	switch {
	case !buttonPressed(d.previous[:], bravoButtonEncoderUp) && buttonPressed(current[:], bravoButtonEncoderUp):
		events = append(events, BravoEvent{Kind: BravoEventEncoder, Name: "ap", Delta: 1})
	case !buttonPressed(d.previous[:], bravoButtonEncoderDown) && buttonPressed(current[:], bravoButtonEncoderDown):
		events = append(events, BravoEvent{Kind: BravoEventEncoder, Name: "ap", Delta: -1})
	}

	switch {
	case !buttonPressed(d.previous[:], bravoButtonTrimUp) && buttonPressed(current[:], bravoButtonTrimUp):
		events = append(events, BravoEvent{Kind: BravoEventTrim, Name: "trim", Delta: 1})
	case !buttonPressed(d.previous[:], bravoButtonTrimDown) && buttonPressed(current[:], bravoButtonTrimDown):
		events = append(events, BravoEvent{Kind: BravoEventTrim, Name: "trim", Delta: -1})
	}

	if currentSelector != "" && currentSelector != d.selector {
		events = append(events, BravoEvent{
			Kind: BravoEventSelector,
			Name: currentSelector,
		})
	}

	d.previous = current
	d.selector = currentSelector

	return events, nil
}

func selectorFromReport(report []byte) string {
	for _, selector := range bravoSelectors {
		if buttonPressed(report, selector.button) {
			return selector.name
		}
	}
	return ""
}

func buttonPressed(report []byte, button int) bool {
	if len(report) < bravoInputReportSize || button < 1 || button > 48 {
		return false
	}

	bit := button - 1
	byteIndex := bravoInputButtonOffset + (bit / 8)
	// Bravo input reports number buttons from LSB to MSB within each byte.
	mask := byte(1 << (bit % 8))

	return report[byteIndex]&mask != 0
}

func formatInputReport(report []byte) string {
	parts := []string{fmt.Sprintf("raw=% X", report)}

	if len(report) >= bravoInputButtonOffset {
		parts = append(parts, fmt.Sprintf("button_bytes=% X", report[bravoInputButtonOffset:]))
	}

	if pressed := pressedButtonNumbers(report); len(pressed) > 0 {
		buttons := make([]string, 0, len(pressed))
		for _, button := range pressed {
			buttons = append(buttons, fmt.Sprintf("%d", button))
		}
		parts = append(parts, "buttons="+strings.Join(buttons, ","))
	}

	if selector := selectorFromReport(report); selector != "" {
		parts = append(parts, "selector="+selector)
	}

	active := make([]string, 0, len(bravoAPButtons)+4)
	for _, button := range bravoAPButtons {
		if buttonPressed(report, button.button) {
			active = append(active, button.name)
		}
	}
	if buttonPressed(report, bravoButtonEncoderUp) {
		active = append(active, "encoder_up")
	}
	if buttonPressed(report, bravoButtonEncoderDown) {
		active = append(active, "encoder_down")
	}
	if buttonPressed(report, bravoButtonTrimUp) {
		active = append(active, "trim_up")
	}
	if buttonPressed(report, bravoButtonTrimDown) {
		active = append(active, "trim_down")
	}

	if len(active) > 0 {
		parts = append(parts, "active="+strings.Join(active, ","))
	}

	return strings.Join(parts, " ")
}

func pressedButtonNumbers(report []byte) []int {
	if len(report) < bravoInputReportSize {
		return nil
	}

	pressed := make([]int, 0, 8)
	for button := 1; button <= 48; button++ {
		if buttonPressed(report, button) {
			pressed = append(pressed, button)
		}
	}

	return pressed
}

func formatBravoEvents(events []BravoEvent) string {
	if len(events) == 0 {
		return "none"
	}

	parts := make([]string, 0, len(events))
	for _, event := range events {
		if event.Delta != 0 {
			parts = append(parts, fmt.Sprintf("%s:%s:%+d", event.Kind, event.Name, event.Delta))
			continue
		}
		parts = append(parts, fmt.Sprintf("%s:%s", event.Kind, event.Name))
	}

	return strings.Join(parts, ", ")
}
