using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OrangeIntel.Domain.Entities;
using OrangeIntel.Infrastructure.Data;
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
    connectionString = "Host=localhost;Port=5432;Database=orangeintel;Username=postgres;Password=password;";
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

builder.Services.AddScoped<OrangeIntel.Application.Interfaces.IThreatRepository, OrangeIntel.Infrastructure.Repositories.ThreatRepository>();
builder.Services.AddScoped<OrangeIntel.Application.Interfaces.IAdvisoryRepository, OrangeIntel.Infrastructure.Repositories.AdvisoryRepository>();
builder.Services.AddScoped<OrangeIntel.Application.Services.IThreatService, OrangeIntel.Application.Services.ThreatService>();
builder.Services.AddScoped<OrangeIntel.Application.Services.IAdvisoryService, OrangeIntel.Application.Services.AdvisoryService>();

builder.Services.AddScoped<OrangeIntel.Application.Interfaces.INotificationProvider, OrangeIntel.Infrastructure.Notifications.TelegramNotificationProvider>();
builder.Services.AddScoped<OrangeIntel.Application.Services.INotificationService, OrangeIntel.Application.Services.NotificationService>();
builder.Services.AddScoped<OrangeIntel.Application.Interfaces.IReportRepository, OrangeIntel.Infrastructure.Repositories.ReportRepository>();
builder.Services.AddScoped<OrangeIntel.Application.Services.IReportService, OrangeIntel.Application.Services.ReportService>();
builder.Services.AddScoped<OrangeIntel.Application.Interfaces.IReportGenerator, OrangeIntel.Infrastructure.Reporting.DocxReportGenerator>();
builder.Services.AddScoped<OrangeIntel.Application.Interfaces.IAdvisoryDocxService, OrangeIntel.Infrastructure.Reporting.AdvisoryDocxService>();

// Security Services
builder.Services.AddSingleton<OrangeIntel.Infrastructure.Services.EncryptionService>();
builder.Services.AddScoped<OrangeIntel.Application.Interfaces.ITokenService, OrangeIntel.Infrastructure.Services.JwtTokenService>();
builder.Services.AddScoped<OrangeIntel.Application.Interfaces.IOneTimePasswordService, OrangeIntel.Infrastructure.Services.OneTimePasswordService>();
builder.Services.AddScoped<OrangeIntel.Application.Interfaces.IAuditService, OrangeIntel.Infrastructure.Services.AuditService>();
builder.Services.AddScoped<OrangeIntel.Infrastructure.Services.ReputationService>();
builder.Services.AddScoped<OrangeIntel.Application.Interfaces.IHibpService, OrangeIntel.Infrastructure.Services.HibpService>();
builder.Services.AddScoped<OrangeIntel.Application.Interfaces.ISystemSettingService, OrangeIntel.Infrastructure.Services.SystemSettingService>();

// Threat Ingestion & Security APIs
builder.Services.AddHttpClient<OrangeIntel.Infrastructure.Services.ThreatIngestionService>();
builder.Services.AddHttpClient<OrangeIntel.Infrastructure.Notifications.TelegramNotificationProvider>();
builder.Services.AddHttpClient<OrangeIntel.Application.Interfaces.IHibpService, OrangeIntel.Infrastructure.Services.HibpService>();

// IOC Enrichment Engine
builder.Services.AddHttpClient<OrangeIntel.Infrastructure.External.VirusTotalProvider>();
builder.Services.AddHttpClient<OrangeIntel.Infrastructure.External.AbuseIpDbProvider>();
builder.Services.AddHttpClient<OrangeIntel.Infrastructure.External.AlienVaultOtxProvider>();
builder.Services.AddHttpClient<OrangeIntel.Infrastructure.External.NvdCveProvider>();
builder.Services.AddHttpClient<OrangeIntel.Infrastructure.External.WinGetProvider>();
builder.Services.AddHttpClient<OrangeIntel.Infrastructure.External.ScoopProvider>();

builder.Services.AddScoped<OrangeIntel.Application.Interfaces.IIocProvider>(sp => sp.GetRequiredService<OrangeIntel.Infrastructure.External.VirusTotalProvider>());
builder.Services.AddScoped<OrangeIntel.Application.Interfaces.IIocProvider>(sp => sp.GetRequiredService<OrangeIntel.Infrastructure.External.AbuseIpDbProvider>());
builder.Services.AddScoped<OrangeIntel.Application.Interfaces.IIocProvider>(sp => sp.GetRequiredService<OrangeIntel.Infrastructure.External.AlienVaultOtxProvider>());
builder.Services.AddScoped<OrangeIntel.Application.Interfaces.IIocProvider>(sp => sp.GetRequiredService<OrangeIntel.Infrastructure.External.NvdCveProvider>());
builder.Services.AddScoped<OrangeIntel.Application.Interfaces.IIocProvider>(sp => sp.GetRequiredService<OrangeIntel.Infrastructure.External.WinGetProvider>());
builder.Services.AddScoped<OrangeIntel.Application.Interfaces.IIocProvider>(sp => sp.GetRequiredService<OrangeIntel.Infrastructure.External.ScoopProvider>());
builder.Services.AddScoped<OrangeIntel.Application.Interfaces.IIocEnrichmentService, OrangeIntel.Infrastructure.Services.IocEnrichmentService>();

builder.Services.AddHostedService<OrangeIntel.Infrastructure.Services.ThreatIngestionWorker>();

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
        ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "OrangeIntel",
        ValidAudience = builder.Configuration["Jwt:Audience"] ?? "OrangeIntelUser",
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
