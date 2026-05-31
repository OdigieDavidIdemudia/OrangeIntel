using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

using OrangeIntel.Domain.Entities;
using System;
using System.Linq;

namespace OrangeIntel.Infrastructure.Data;

public class ApplicationDbContext : IdentityDbContext<AppUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    public DbSet<ThreatSource> ThreatSources { get; set; }
    public DbSet<ThreatItem> ThreatItems { get; set; }
    public DbSet<AppUser> Users { get; set; }
    public DbSet<Advisory> Advisories { get; set; }
    public DbSet<AdvisoryDraft> AdvisoryDrafts { get; set; }
    public DbSet<Indicator> Indicators { get; set; }
    public DbSet<Report> Reports { get; set; }
    public DbSet<AuditLog> AuditLogs { get; set; }
    public DbSet<IocAuditLog> IocAuditLogs { get; set; }
    public DbSet<SystemSetting> SystemSettings { get; set; }
    public DbSet<UserApiKey> UserApiKeys { get; set; }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Map to snake_case tables
        builder.Entity<AppUser>().ToTable("users");
        builder.Entity<AuditLog>().ToTable("audit_logs");
        builder.Entity<ThreatSource>().ToTable("threat_sources");
        builder.Entity<ThreatItem>().ToTable("threat_items");
        builder.Entity<Indicator>().ToTable("indicators");
        builder.Entity<Advisory>().ToTable("advisories");
        builder.Entity<Report>().ToTable("reports");
        builder.Entity<AdvisoryDraft>().ToTable("advisory_drafts");
        builder.Entity<SystemSetting>().ToTable("system_settings");

        // ThreatItem Config
        builder.Entity<ThreatItem>()
            .HasOne(t => t.Source)
            .WithMany()
            .HasForeignKey(t => t.SourceId);

        builder.Entity<ThreatItem>()
            .HasMany(t => t.Indicators)
            .WithOne(i => i.Threat)
            .HasForeignKey(i => i.ThreatId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<ThreatItem>()
            .Property(t => t.MetadataJson)
            .HasColumnType("jsonb");
            
        builder.Entity<ThreatItem>()
            .HasIndex(t => t.HashDedup)
            .IsUnique();

        var listComparer = new ValueComparer<List<string>>(
            (c1, c2) => c1 != null && c2 != null ? c1.SequenceEqual(c2) : c1 == c2,
            c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
            c => c.ToList());

        // Advisory Config
        builder.Entity<Advisory>()
            .Property(t => t.ImpactedSectors)
            .HasConversion(
                v => string.Join(';', v),
                v => v.Split(';', StringSplitOptions.RemoveEmptyEntries).ToList())
            .Metadata.SetValueComparer(listComparer);

        builder.Entity<Advisory>()
            .Property(t => t.AffectedAssets)
            .HasConversion(
                v => string.Join(';', v),
                v => v.Split(';', StringSplitOptions.RemoveEmptyEntries).ToList())
            .Metadata.SetValueComparer(listComparer);

        builder.Entity<Advisory>()
            .Property(t => t.Recommendations)
            .HasConversion(
                v => string.Join(';', v),
                v => v.Split(';', StringSplitOptions.RemoveEmptyEntries).ToList())
            .Metadata.SetValueComparer(listComparer);

        builder.Entity<Advisory>()
            .Property(t => t.IOCs)
            .HasConversion(
                v => string.Join(';', v),
                v => v.Split(';', StringSplitOptions.RemoveEmptyEntries).ToList())
            .Metadata.SetValueComparer(listComparer);
        
        builder.Entity<Advisory>()
            .Property(t => t.References)
            .HasConversion(
                v => string.Join(';', v),
                v => v.Split(';', StringSplitOptions.RemoveEmptyEntries).ToList())
            .Metadata.SetValueComparer(listComparer);

        // System Settings Config
        builder.Entity<SystemSetting>()
            .HasIndex(s => s.Key)
            .IsUnique();

        // UserApiKey Config
        builder.Entity<UserApiKey>().ToTable("user_api_keys");
        builder.Entity<UserApiKey>()
            .HasIndex(k => new { k.UserId, k.KeyName })
            .IsUnique();
    }
}
