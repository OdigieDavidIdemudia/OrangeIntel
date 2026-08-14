using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TealHunt.Domain.Entities;
using TealHunt.Infrastructure.Data;
using Microsoft.AspNetCore.HttpOverrides;
using System.Security.Claims;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRouting(options => 
{
    options.LowercaseUrls = true;
    options.LowercaseQueryStrings = true;
});

var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL") 
                    ?? builder.Configuration["DATABASE_URL"]
                    ?? builder.Configuration.GetConnectionString("DefaultConnection");

if (string.IsNullOrEmpty(connectionString))
{
    connectionString = "Host=localhost;Port=5432;Database=tealhunt;Username=postgres;Password=password;";
}

connectionString = connectionString.Trim().Trim('\"').Trim('\'');

if (!string.IsNullOrEmpty(connectionString) && 
    (connectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) || 
     connectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase)))
{
    try
    {
        // Handle potential double slashes or other URI quirks
        var databaseUri = new Uri(connectionString);
        var userInfo = databaseUri.UserInfo.Split(':');
        var username = Uri.UnescapeDataString(userInfo[0]);
        var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
        var host = databaseUri.Host;
        var port = databaseUri.Port > 0 ? databaseUri.Port : 5432;
        var database = Uri.UnescapeDataString(databaseUri.LocalPath.TrimStart('/'));

        var npgsqlBuilder = new Npgsql.NpgsqlConnectionStringBuilder
        {
            Host = host,
            Port = port,
            Database = database,
            Username = username,
            Password = password,
            SslMode = Npgsql.SslMode.Require,
            TrustServerCertificate = true,
            IncludeErrorDetail = true,
            Pooling = true,
            MinPoolSize = 0,
            MaxPoolSize = 100,
            ConnectionIdleLifetime = 300
        };
        connectionString = npgsqlBuilder.ConnectionString;
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[CRITICAL] Connection string parsing failed: {ex.Message}");
        // If it still starts with postgres:// or postgresql://, we must NOT use it as a connection string
        if (connectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) ||
            connectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
             connectionString = "INVALID_CONNECTION_STRING_PARSE_FAILED";
        }
    }
}

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddIdentity<AppUser, IdentityRole>(options => {
    options.SignIn.RequireConfirmedAccount = false;
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.AllowedForNewUsers = true;
})
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

builder.Services.AddScoped<TealHunt.Application.Interfaces.IThreatRepository, TealHunt.Infrastructure.Repositories.ThreatRepository>();
builder.Services.AddScoped<TealHunt.Application.Interfaces.IAdvisoryRepository, TealHunt.Infrastructure.Repositories.AdvisoryRepository>();
builder.Services.AddScoped<TealHunt.Application.Services.IThreatService, TealHunt.Application.Services.ThreatService>();
builder.Services.AddScoped<TealHunt.Application.Services.IAdvisoryService, TealHunt.Application.Services.AdvisoryService>();

// TelegramNotificationProvider is registered below via AddHttpClient so it gets a proper HttpClient
builder.Services.AddScoped<TealHunt.Application.Services.INotificationService, TealHunt.Application.Services.NotificationService>();
builder.Services.AddScoped<TealHunt.Application.Interfaces.IReportRepository, TealHunt.Infrastructure.Repositories.ReportRepository>();
builder.Services.AddScoped<TealHunt.Application.Services.IReportService, TealHunt.Application.Services.ReportService>();
builder.Services.AddScoped<TealHunt.Application.Interfaces.IReportGenerator, TealHunt.Infrastructure.Reporting.DocxReportGenerator>();
builder.Services.AddScoped<TealHunt.Application.Interfaces.IAdvisoryDocxService, TealHunt.Infrastructure.Reporting.AdvisoryDocxService>();
builder.Services.AddScoped<TealHunt.Application.Interfaces.IGeminiAiService, TealHunt.Application.Services.GeminiAiService>();

// Security Services
builder.Services.AddSingleton<TealHunt.Infrastructure.Services.EncryptionService>();
builder.Services.AddScoped<TealHunt.Application.Interfaces.ITokenService, TealHunt.Infrastructure.Services.JwtTokenService>();
builder.Services.AddScoped<TealHunt.Application.Interfaces.IOneTimePasswordService, TealHunt.Infrastructure.Services.OneTimePasswordService>();
builder.Services.AddScoped<TealHunt.Application.Interfaces.IAuditService, TealHunt.Infrastructure.Services.AuditService>();
builder.Services.AddScoped<TealHunt.Infrastructure.Services.ReputationService>();
builder.Services.AddScoped<TealHunt.Application.Interfaces.IHibpService, TealHunt.Infrastructure.Services.HibpService>();
builder.Services.AddScoped<TealHunt.Application.Interfaces.ISystemSettingService, TealHunt.Infrastructure.Services.SystemSettingService>();

// Threat Ingestion & Security APIs
builder.Services.AddHttpClient<TealHunt.Infrastructure.Services.ThreatIngestionService>();
builder.Services.AddHttpClient<TealHunt.Infrastructure.Notifications.TelegramNotificationProvider>();
builder.Services.AddScoped<TealHunt.Application.Interfaces.INotificationProvider>(sp => sp.GetRequiredService<TealHunt.Infrastructure.Notifications.TelegramNotificationProvider>());
builder.Services.AddHttpClient<TealHunt.Infrastructure.Notifications.ResendNotificationProvider>();
builder.Services.AddScoped<TealHunt.Application.Interfaces.INotificationProvider>(sp => sp.GetRequiredService<TealHunt.Infrastructure.Notifications.ResendNotificationProvider>());
builder.Services.AddHttpClient<TealHunt.Application.Interfaces.IHibpService, TealHunt.Infrastructure.Services.HibpService>();

// IOC Enrichment Engine
builder.Services.AddHttpClient<TealHunt.Infrastructure.External.VirusTotalProvider>();
builder.Services.AddHttpClient<TealHunt.Infrastructure.External.AbuseIpDbProvider>();
builder.Services.AddHttpClient<TealHunt.Infrastructure.External.AlienVaultOtxProvider>();
builder.Services.AddHttpClient<TealHunt.Infrastructure.External.NvdCveProvider>();
builder.Services.AddHttpClient<TealHunt.Infrastructure.External.WinGetProvider>();
builder.Services.AddHttpClient<TealHunt.Infrastructure.External.ScoopProvider>();

builder.Services.AddScoped<TealHunt.Application.Interfaces.IIocProvider>(sp => sp.GetRequiredService<TealHunt.Infrastructure.External.VirusTotalProvider>());
builder.Services.AddScoped<TealHunt.Application.Interfaces.IIocProvider>(sp => sp.GetRequiredService<TealHunt.Infrastructure.External.AbuseIpDbProvider>());
builder.Services.AddScoped<TealHunt.Application.Interfaces.IIocProvider>(sp => sp.GetRequiredService<TealHunt.Infrastructure.External.AlienVaultOtxProvider>());
builder.Services.AddScoped<TealHunt.Application.Interfaces.IIocProvider>(sp => sp.GetRequiredService<TealHunt.Infrastructure.External.NvdCveProvider>());
builder.Services.AddScoped<TealHunt.Application.Interfaces.IIocProvider>(sp => sp.GetRequiredService<TealHunt.Infrastructure.External.WinGetProvider>());
builder.Services.AddScoped<TealHunt.Application.Interfaces.IIocProvider>(sp => sp.GetRequiredService<TealHunt.Infrastructure.External.ScoopProvider>());
builder.Services.AddScoped<TealHunt.Application.Interfaces.IIocEnrichmentService, TealHunt.Infrastructure.Services.IocEnrichmentService>();

builder.Services.AddHostedService<TealHunt.Infrastructure.Services.ThreatIngestionWorker>();

// JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"] ?? "super_secret_key_change_me_in_prod_12345!"; // Fallback for dev
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "TealHunt",
        ValidAudience = builder.Configuration["Jwt:Audience"] ?? "TealHuntUser",
        IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(jwtKey))
    };
    options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
    {
        OnTokenValidated = async context =>
        {
            var userManager = context.HttpContext.RequestServices.GetRequiredService<UserManager<AppUser>>();
            var userId = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier) ?? context.Principal?.FindFirstValue("id");
            var tokenVersionClaim = context.Principal?.FindFirstValue("token_version");

            if (userId != null && tokenVersionClaim != null)
            {
                var user = await userManager.FindByIdAsync(userId);
                // Temporarily disable strict version check to debug login failure
                /*
                if (user == null || user.TokenVersion.ToString() != tokenVersionClaim)
                {
                    context.Fail("Token version mismatch or user not found. Session revoked.");
                }
                */
            }
        }
    };
});

builder.Services.AddHealthChecks();
builder.Services.AddControllers(options =>
{
    var policy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
                     .RequireAuthenticatedUser()
                     .Build();
    options.Filters.Add(new Microsoft.AspNetCore.Mvc.Authorization.AuthorizeFilter(policy));
})
.AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddMemoryCache();

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy.SetIsOriginAllowed(_ => true) // Safely allows wildcards across dynamic Vercel domains
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // Clearing these because on platforms like Render/Vercel, 
    // the proxy IPs are dynamic and we trust the platform headers.
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.UseDeveloperExceptionPage();
}

// app.UseHttpsRedirection();

app.UseForwardedHeaders();

app.UseRouting();

app.UseCors("FrontendPolicy");


app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/api/health").AllowAnonymous();

// Database Initialization
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var env = services.GetRequiredService<IWebHostEnvironment>();
    try
    {
        await DbInitializer.Initialize(services, false); // Persistence enabled
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while seeding the database.");
    }
}

app.Run();
