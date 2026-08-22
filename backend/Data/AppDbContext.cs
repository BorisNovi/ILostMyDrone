using Microsoft.EntityFrameworkCore;

namespace LostDroneApi.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{}