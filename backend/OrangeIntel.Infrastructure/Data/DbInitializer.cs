using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using OrangeIntel.Domain.Entities;

namespace OrangeIntel.Infrastructure.Data;

public static class DbInitializer
{
    public static async Task Initialize(IServiceProvider serviceProvider, bool resetDb)
    {
        System.IO.File.AppendAllText("seed_log.txt", $"Starting DB Init at {DateTime.UtcNow}\n");
        try {
        var context = serviceProvider.GetRequiredService<ApplicationDbContext>();
        var userManager = serviceProvider.GetRequiredService<UserManager<AppUser>>();
        var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole>>();

        if (resetDb)
        {
            await context.Database.EnsureDeletedAsync();
            await context.Database.EnsureCreatedAsync();
        }
        else
        {
            await context.Database.EnsureCreatedAsync();
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
        var adminEmail = "admin@orangeintel.local";
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
             logger.LogInformation("SuperAdmin user already exists.");
        }

        /*
        // Seed ThreatItems
        if (!context.ThreatItems.Any())
        {
             // Real ingestion will be handled by ThreatIngestionService
        }
        */
        System.IO.File.AppendAllText("seed_log.txt", "DB Init Completed Successfully\n");
        } catch (Exception ex) {
            System.IO.File.AppendAllText("seed_log.txt", $"DB Init Failed: {ex}\n");
            throw;
        }
    }
}
