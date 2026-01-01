package analysis

import (
	"strings"
)

type KeywordAnalyzer struct {
	Keywords map[string]int
}

func NewKeywordAnalyzer() *KeywordAnalyzer {
	return &KeywordAnalyzer{
		Keywords: map[string]int{
			"bank":        10,
			"financial":   10,
			"ransomware":  20,
			"critical":    15,
			"urgent":      15,
			"apt":         20,
			"phishing":    10,
			"credentials": 10,
			"gtbank":      50, // Specific organizational keyword
			"leak":        15,
		},
	}
}

func (k *KeywordAnalyzer) Name() string {
	return "Keyword Analyzer"
}

func (k *KeywordAnalyzer) Analyze(content string) (int, map[string]interface{}) {
	score := 0
	matches := []string{}
	lowerContent := strings.ToLower(content)

	for word, weight := range k.Keywords {
		if strings.Contains(lowerContent, word) {
			score += weight
			matches = append(matches, word)
		}
	}

	// Cap score at 100
	if score > 100 {
		score = 100
	}

	return score, map[string]interface{}{
		"matches": matches,
	}
}
