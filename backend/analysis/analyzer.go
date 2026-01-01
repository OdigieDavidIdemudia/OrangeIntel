package analysis

// Analyzer defines the interface for any component that assesses threat intelligence.
type Analyzer interface {
	Name() string
	Analyze(content string) (int, map[string]interface{})
}
