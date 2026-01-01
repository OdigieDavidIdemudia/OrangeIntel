package ingest

// FeedItem represents a single unit of threat intelligence.
type FeedItem struct {
	Source string
	Data   string // Raw JSON or content
}

// Source defines the interface for pulling threat data.
type Source interface {
	Name() string
	Fetch() ([]FeedItem, error)
}
