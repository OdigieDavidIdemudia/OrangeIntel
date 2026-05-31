using System;
using System.Collections.Generic;

namespace OrangeIntel.Application.DTOs;

public class IocLookupRequest
{
    public string Indicator { get; set; } = string.Empty;
}

public class BulkIocLookupRequest
{
    public List<string> Indicators { get; set; } = new List<string>();
}

public class ProviderResult
{
    public string ProviderName { get; set; } = string.Empty;
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public object RawData { get; set; } = new object();
}

public class IocLookupResponse
{
    public string IndicatorValue { get; set; } = string.Empty;
    public string IndicatorType { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public int UnifiedRiskScore { get; set; }
    public List<ProviderResult> ProviderResults { get; set; } = new List<ProviderResult>();
    public bool IsCached { get; set; }
    public DateTime QueriedAt { get; set; }
}

public class BulkIocLookupResponse
{
    public List<IocLookupResponse> Results { get; set; } = new List<IocLookupResponse>();
    public int TotalProcessed { get; set; }
    public int ErrorCount { get; set; }
}

public class IocHistoryDto
{
    public int Id { get; set; }
    public string IndicatorValue { get; set; } = string.Empty;
    public string IndicatorType { get; set; } = string.Empty;
    public int RiskScore { get; set; }
    public DateTime QueriedAt { get; set; }
    public string QueriedByUserId { get; set; } = string.Empty;
}
