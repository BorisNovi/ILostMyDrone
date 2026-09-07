using LostDroneApi.Models;
using Microsoft.EntityFrameworkCore;

namespace LostDroneApi.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<CheckedCell> CheckedCells => Set<CheckedCell>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Session>(entity =>
        {
            entity.HasKey(s => s.Id);
            entity.Property(s => s.Id).HasMaxLength(32);
            entity.Property(s => s.CreatorToken).HasMaxLength(64);
        });

        modelBuilder.Entity<CheckedCell>(entity =>
        {
            entity.HasKey(c => new { c.SessionId, c.CellX, c.CellY });
            entity.Property(c => c.Color).HasMaxLength(6);

            entity.HasOne<Session>()
                .WithMany()
                .HasForeignKey(c => c.SessionId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}