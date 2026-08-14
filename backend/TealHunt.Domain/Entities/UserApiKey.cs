using System;

namespace TealHunt.Domain.Entities;

/// <summary>
/// Stores per-user API keys for IOC enrichment providers.
/// These take priority over the global system-level keys set by admins.
/// </summary>
public class UserApiKey
{
    public int Id { get; set; }

    /// <summary>The user this key belongs to.</summary>
    public string UserId { get; set; } = string.Empty;

    /// <summary>The provider key name, e.g. "vt_api_key", "abuseipdb_api_key", "alienvault_api_key".</summary>
    public string KeyName { get; set; } = string.Empty;

    /// <summary>The encrypted or plain-text API key value.</summary>
    public string KeyValue { get; set; } = string.Empty;

    public DateTime LastUpdatedAt { get; set; } = DateTime.UtcNow;
}
