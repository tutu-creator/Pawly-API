using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Pawly_sayt.Models;

namespace Pawly_sayt.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Listing> Listings => Set<Listing>();
    public DbSet<ListingPhoto> ListingPhotos => Set<ListingPhoto>();
    public DbSet<VolunteerApplication> VolunteerApplications => Set<VolunteerApplication>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<ListingReport> ListingReports => Set<ListingReport>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>(user =>
        {
            user.Property(u => u.Email).HasMaxLength(150);
            user.HasIndex(u => u.Email).IsUnique();
        });

        modelBuilder.Entity<Listing>()
            .HasOne(l => l.User)
            .WithMany()
            .HasForeignKey(l => l.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<ListingReport>(report =>
        {
            report.Property(r => r.Comment).HasMaxLength(500);

            // Bir istifadəçi eyni elana yalnız bir dəfə şikayət edə bilər
            report.HasIndex(r => new { r.ListingId, r.UserId }).IsUnique();

            // Elan silinəndə onun şikayətləri də silinir
            report.HasOne(r => r.Listing)
                .WithMany()
                .HasForeignKey(r => r.ListingId)
                .OnDelete(DeleteBehavior.Cascade);

            // İstifadəçi silinsə belə şikayət qalır (SQL Server dövri silmələrə icazə vermir)
            report.HasOne(r => r.User)
                .WithMany()
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Bütün tarixləri UTC kimi işarələyirik.
        // Bazaya hər şeyi UTC yazırıq, oxuyanda da "bu UTC-dir" deyirik ki,
        // brauzer vaxtı istifadəçinin saat qurşağına (Bakı: UTC+4) düzgün çevirsin.
        var utcConverter = new ValueConverter<DateTime, DateTime>(
            toDb => toDb,
            fromDb => DateTime.SpecifyKind(fromDb, DateTimeKind.Utc));

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(DateTime) || property.ClrType == typeof(DateTime?))
                {
                    property.SetValueConverter(utcConverter);
                }
            }
        }
    }
}