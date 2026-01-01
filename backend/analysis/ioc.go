package analysis

import (
	"regexp"
)

type IOCAnalyzer struct{}

func NewIOCAnalyzer() *IOCAnalyzer {
	return &IOCAnalyzer{}
}

func (i *IOCAnalyzer) Name() string {
	return "IOC Extractor"
}

func (i *IOCAnalyzer) Analyze(content string) []NormalizedIOC {
	matches := []NormalizedIOC{}

	// Regex Patterns
	ipRegex := regexp.MustCompile(`\b(?:\d{1,3}\.){3}\d{1,3}\b`)
	emailRegex := regexp.MustCompile(`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`)
	hashRegex := regexp.MustCompile(`\b[a-fA-F0-9]{32,64}\b`)
	domainRegex := regexp.MustCompile(`(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}`)

	// Find IPs
	ips := ipRegex.FindAllString(content, -1)
	for _, ip := range ips {
		matches = append(matches, NormalizedIOC{Value: ip, Type: "ip"})
	}

	// Find Emails
	emails := emailRegex.FindAllString(content, -1)
	for _, email := range emails {
		matches = append(matches, NormalizedIOC{Value: email, Type: "email"})
	}

	// Find Hashes
	hashes := hashRegex.FindAllString(content, -1)
	for _, hash := range hashes {
		matches = append(matches, NormalizedIOC{Value: hash, Type: "hash"})
	}

	// Find Domains (Basic)
	domains := domainRegex.FindAllString(content, -1)
	for _, domain := range domains {
		// rudimentary filter to avoid matching IPs as domains or random text
		if len(domain) > 3 && !ipRegex.MatchString(domain) {
			matches = append(matches, NormalizedIOC{Value: domain, Type: "domain"})
		}
	}

	return removeDuplicateIOCs(matches)
}

func removeDuplicateIOCs(iocs []NormalizedIOC) []NormalizedIOC {
	allKeys := make(map[string]bool)
	list := []NormalizedIOC{}
	for _, item := range iocs {
		if _, value := allKeys[item.Value]; !value {
			allKeys[item.Value] = true
			list = append(list, item)
		}
	}
	return list
}
