package integrations

import (
	"orangeintel-backend/internal/models"
	"time"
)

// Source defines the contract for any threat intelligence feed integration
type Source interface {
	// Name returns the unique identifier of the source (e.g., "CISA_KEV")
	Name() string

	// Fetch retrieves data using the provided client and normalizes it into Topics
	Fetch(client *Client) ([]models.Topic, error)

	// Interval returns how often this source should be polled
	Interval() time.Duration
}
