using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TealHunt.Domain.Entities;

namespace TealHunt.Infrastructure.Data;

public static class DbInitializer
{
    public static async Task Initialize(IServiceProvider serviceProvider, bool resetDb)
    {
        System.IO.File.AppendAllText("seed_log.txt", $"Starting DB Init at {DateTime.UtcNow}\n");
        try {
        var context = serviceProvider.GetRequiredService<ApplicationDbContext>();
        var userManager = serviceProvider.GetRequiredService<UserManager<AppUser>>();
        var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole>>();

        var conn = context.Database.GetDbConnection();
        var sanitizedConn = conn.ConnectionString;
        if (sanitizedConn != null && sanitizedConn.Contains("Password=")) {
            sanitizedConn = "ConnectionString present (hidden password)";
        }
        System.IO.File.AppendAllText("seed_log.txt", $"Connection String: {sanitizedConn}\n");

        if (resetDb)
        {
            await context.Database.EnsureDeletedAsync();
            await context.Database.MigrateAsync();
        }
        else
        {
            await context.Database.MigrateAsync();
        }

        // Seed Roles
        string[] roles = { "super_admin", "admin", "analyst" };
        foreach (var role in roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
            }
        }

        // Seed SuperAdmin
        var adminEmail = "admin@tealhunt.local";
        if (await userManager.FindByEmailAsync(adminEmail) == null)
        {
            var admin = new AppUser
            {
                UserName = adminEmail,
                Email = adminEmail,
                EmailConfirmed = true,
                CreatedAt = DateTime.UtcNow
            };
            var result = await userManager.CreateAsync(admin, "Admin123!");
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(admin, "super_admin");
                var logger = serviceProvider.GetRequiredService<Microsoft.Extensions.Logging.ILogger<ApplicationDbContext>>();
                logger.LogInformation("SuperAdmin user seeded successfully.");
            }
            else
            {
                 var logger = serviceProvider.GetRequiredService<Microsoft.Extensions.Logging.ILogger<ApplicationDbContext>>();
                 var errorMsg = $"Failed to seed SuperAdmin: {string.Join(", ", result.Errors.Select(e => e.Description))}";
                 logger.LogError(errorMsg);
                 System.IO.File.AppendAllText("seed_log.txt", errorMsg + "\n");
            }
        }
        else
        {
             var logger = serviceProvider.GetRequiredService<Microsoft.Extensions.Logging.ILogger<ApplicationDbContext>>();
             logger.LogInformation("SuperAdmin user already exists. Forcing password reset for production safety.");
             var admin = await userManager.FindByEmailAsync(adminEmail);
             await userManager.RemovePasswordAsync(admin);
             await userManager.AddPasswordAsync(admin, "Admin123!");
        }

        /*
        // Seed ThreatItems
        if (!context.ThreatItems.Any())
        {
             // Real ingestion will be handled by ThreatIngestionService
        }
        */

        // Run Sector Classification Migration
        var threatService = serviceProvider.GetRequiredService<TealHunt.Application.Services.IThreatService>();
        await threatService.MigrateExistingThreatsAsync();
        
        // Auto-tag Categories for existing uncategorized threats
        var ingestionService = serviceProvider.GetRequiredService<TealHunt.Infrastructure.Services.ThreatIngestionService>();
        var uncategorizedThreats = await context.ThreatItems.Where(t => t.Category == "" || t.Category == "Uncategorized").ToListAsync();
        if (uncategorizedThreats.Any())
        {
            var categoryLogger = serviceProvider.GetRequiredService<Microsoft.Extensions.Logging.ILogger<ApplicationDbContext>>();
            categoryLogger.LogInformation($"Auto-tagging {uncategorizedThreats.Count} existing threats with categories.");
            foreach (var threat in uncategorizedThreats)
            {
                var textToAnalyze = $"{threat.Title} {threat.Summary}";
                threat.Category = ingestionService.DetermineCategory(textToAnalyze);
            }
            await context.SaveChangesAsync();
        }

        System.IO.File.AppendAllText("seed_log.txt", "DB Init Completed Successfully\n");
        } catch (Exception ex) {
            System.IO.File.AppendAllText("seed_log.txt", $"DB Init Failed: {ex}\n");
            throw;
        }
    }
}
