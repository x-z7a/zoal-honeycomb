package honeycomb

import (
	"fmt"

	"github.com/x-z7a/zoal-honeycomb/pkg"
)

type ConsoleLogger struct {
}

func (m *ConsoleLogger) Infof(format string, a ...interface{}) {
	fmt.Println("Info:", fmt.Sprintf(format, a...))
}

func (m *ConsoleLogger) Info(msg string) {
	fmt.Println("Info:", msg)
}

func (m *ConsoleLogger) Debugf(format string, a ...interface{}) {
	fmt.Println("Debug:", fmt.Sprintf(format, a...))
}

func (m *ConsoleLogger) Debug(msg string) {
	fmt.Println(msg)
}

func (m *ConsoleLogger) Error(msg string) {
	fmt.Println(msg)
}

func (m *ConsoleLogger) Warningf(format string, a ...interface{}) {
	fmt.Println("Warning:", fmt.Sprintf(format, a...))
}

func (m *ConsoleLogger) Warning(msg string) {
	fmt.Println("Warning:", msg)
}

func (m *ConsoleLogger) Errorf(format string, a ...interface{}) {
	fmt.Println("Error:", fmt.Sprintf(format, a...))
}

func NewConsoleLogger() pkg.Logger {
	return &ConsoleLogger{}
}
