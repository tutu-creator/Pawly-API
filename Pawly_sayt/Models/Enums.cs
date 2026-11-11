namespace Pawly_sayt.Models;

public enum ListingType
{
    Stray = 1,      // Sahibsiz heyvan
    Lost = 2,       // İtmiş ev heyvanı
    NeedsHelp = 3   // Qayğıya ehtiyacı olan heyvan
}

public enum AnimalKind
{
    Dog = 1,
    Cat = 2,
    Other = 3
}

public enum ListingStatus
{
    Active = 1,     // Elan aktivdir
    Resolved = 2    // Tapıldı / kömək edildi
}

// Şikayətin səbəbi
public enum ReportReason
{
    Fake = 1,             // Saxta elan
    Inappropriate = 2,    // Uyğunsuz / təhqiramiz məzmun
    Spam = 3,             // Spam, reklam
    AlreadyResolved = 4,  // Heyvan artıq tapılıb
    Other = 5             // Digər
}

// Şikayətin vəziyyəti (admin panelində istifadə olunacaq)
public enum ReportStatus
{
    Open = 1,       // Yeni, baxılmayıb
    Reviewed = 2    // Admin baxıb
}



// İstifadəçi rolu
public enum UserRole
{
    User = 0,    // Adi istifadəçi (mövcud hesablar avtomatik bu olur)
    Admin = 1    // Admin paneli açıqdır
}