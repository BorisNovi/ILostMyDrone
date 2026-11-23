namespace LostDroneApi.Extensions;

public static class CorsExtensions
{
    /// <summary>
    /// Registers a default CORS policy allowing only the origins listed under Cors:AllowedOrigins
    /// in configuration (e.g. the frontend's own URL), for GET/POST with any headers.
    /// </summary>
    public static IServiceCollection AddCorsPolicy(this IServiceCollection services, IConfiguration configuration)
    {
        var allowedOrigins = configuration
            .GetSection("Cors:AllowedOrigins")
            .Get<string[]>() ?? [];

        services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy =>
            {
                policy.WithOrigins(allowedOrigins)
                      .WithMethods("GET", "POST")
                      .AllowAnyHeader();
            });
        });

        return services;
    }
}
