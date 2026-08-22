using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace LostDroneApi.Extensions;

public static class RateLimiterExtensions
{
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
