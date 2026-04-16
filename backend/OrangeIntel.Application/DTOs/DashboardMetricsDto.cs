using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;
using OrangeIntel.Domain.Entities;

namespace OrangeIntel.Application.DTOs;

public class DashboardMetricsDto
{
    public string OverallState { get; set; } = "CALM"; // CALM, ELEVATED, CRITICAL
    
    public Dictionary<string, PriorityMetric> ThreatCounts { get; set; } = new();
    
    // New Segmented Metrics
    public Dictionary<string, int> SeverityCounts { get; set; } = new();
    public Dictionary<string, int> EnvironmentThreats { get; set; } = new();
    public Dictionary<string, int> TeamDistribution { get; set; } = new();
    public Dictionary<string, double> RiskDistribution { get; set; } = new();
    
    public ThreatVelocityDto Velocity { get; set; } = new();
    
    public TimeSpan? TimeSinceLastCriticalThreat { get; set; }
    public DateTime? LastCriticalThreatTime { get; set; }
    
    public IEnumerable<ThreatItem> RecentThreats { get; set; } = new List<ThreatItem>();
    
    public SystemHealthDto SystemHealth { get; set; } = new();
}

public class PriorityMetric
{
    public int Count { get; set; }
    public int DeltaSinceOneHour { get; set; } // +ve or -ve change
}

public class SystemHealthDto
{
    public string Status { get; set; } = "Healthy";
    public string Database { get; set; } = "Unknown";
    public string Ingestion { get; set; } = "Unknown";
    public double IngestLatencyMs { get; set; }
    public int ErrorCount24h { get; set; }
    public DateTime? LastCorrelationRun { get; set; }
}
