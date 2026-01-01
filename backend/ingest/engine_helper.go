package ingest

import (
	"encoding/json"
)

func jsonIOCs(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}
