using Microsoft.Extensions.Caching.Memory;

namespace Pawly_sayt.Services;

// Cəhdləri ünvana (IP) görə yox, açara görə sayır: məsələn, e-poçta görə.
// Hostinq ziyarətçilərin real ünvanını ötürmədiyi üçün bu yol daha etibarlıdır.
public class AttemptLimiter
{
    private readonly IMemoryCache _cache;

    public AttemptLimiter(IMemoryCache cache)
    {
        _cache = cache;
    }

    // Bu açar üçün limit dolubmu?
    public bool IsBlocked(string key, int limit) =>
        _cache.TryGetValue(key, out Counter? counter) && counter!.Count >= limit;

    // Bir cəhd qeyd edir. Sayğac ilk cəhddən "window" müddəti sonra sıfırlanır.
    public void Register(string key, TimeSpan window)
    {
        var counter = _cache.GetOrCreate(key, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = window;
            return new Counter();
        })!;
        Interlocked.Increment(ref counter.Count);
    }

    // Sayğacı silir (məsələn, uğurlu girişdən sonra)
    public void Reset(string key) => _cache.Remove(key);

    private class Counter
    {
        public int Count;
    }
}