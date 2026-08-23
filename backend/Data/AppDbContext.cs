using LostDroneApi.Models;
using Microsoft.EntityFrameworkCore;

namespace LostDroneApi.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Session> Sessions => Set<Session>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Session>(entity =>
        {
            entity.HasKey(s => s.Id);
            entity.Property(s => s.Id).HasMaxLength(32);
            entity.Property(s => s.CreatorToken).HasMaxLength(64);
        });
    }
}