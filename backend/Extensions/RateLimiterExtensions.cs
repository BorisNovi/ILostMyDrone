using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace LostDroneApi.Extensions;

public static class RateLimiterExtensions
{
    /// <summary>
    /// Registers two per-IP sliding-window rate limit policies used on SessionsController:
    /// "create" (10 requests/min, for POST) and "read" (60 requests/min, for GET/DELETE).
    /// </summary>
    public static IServiceCollection AddRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            options.AddPolicy("create", context =>
                RateLimitPartition.GetSlidingWindowLimiter(
                    partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    factory: _ => new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = 10,
                        Window = TimeSpan.FromMinutes(1),
                        SegmentsPerWindow = 2,
                        QueueLimit = 0,
                        QueueProcessingOrder = QueueProcessingOrder.NewestFirst
                    }));

            options.AddPolicy("read", context =>
                RateLimitPartition.GetSlidingWindowLimiter(
                    partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    factory: _ => new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = 60,
                        Window = TimeSpan.FromMinutes(1),
                        SegmentsPerWindow = 2,
                        QueueLimit = 0,
                        QueueProcessingOrder = QueueProcessingOrder.NewestFirst
                    }));
        });

        return services;
    }
}
