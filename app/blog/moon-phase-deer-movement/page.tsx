import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Moon Phase and Deer Movement: Why Generic Lunar Calendars Fail — DeerStats",
  description: "Moon phase is a real variable — but a generic lunar calendar can't tell you how YOUR buck responds to it. Here's why individual patterning is the only reliable approach.",
  openGraph: {
    title: "Moon Phase and Deer Movement: Why Generic Lunar Calendars Fail",
    description: "Moon phase is real, but a generic lunar calendar can't tell you how your specific buck responds. Here's what the science actually says — and what to do instead.",
    url: "https://www.deerstats.com/blog/moon-phase-deer-movement",
    type: "article",
  },
};

const s = {
  body: { color: "#3a2a0a", lineHeight: 1.8, marginBottom: "20px" } as React.CSSProperties,
  h2: { fontFamily: "Georgia, serif", fontSize: "24px", color: "#1a2e0a", marginBottom: "16px", marginTop: "40px" } as React.CSSProperties,
  h3: { fontFamily: "Georgia, serif", fontSize: "20px", color: "#2d5016", marginBottom: "12px", marginTop: "28px" } as React.CSSProperties,
  cite: { color: "#6a5a3a", fontSize: "14px", fontStyle: "italic", marginBottom: "24px", display: "block" } as React.CSSProperties,
  bq: { borderLeft: "4px solid #2d5016", paddingLeft: "20px", color: "#3a2a0a", fontStyle: "italic", lineHeight: 1.8, marginBottom: "16px" } as React.CSSProperties,
  li: { color: "#3a2a0a", lineHeight: 1.8, paddingLeft: "20px", marginBottom: "16px" } as React.CSSProperties,
};

export default function MoonPhasePage() {
  return (
    <main style={{ maxWidth: "760px", margin: "0 auto", padding: "48px 24px" }}>
      {/* Tag + date */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <span style={{ backgroundColor: "#2d5016", color: "#fff", fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "20px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Science</span>
        <span style={{ color: "#8a7a5a", fontSize: "13px" }}>April 8, 2026 · 8 min read</span>
      </div>

      <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(26px, 5vw, 38px)", color: "#1a2e0a", lineHeight: 1.25, marginBottom: "24px" }}>
        Moon Phase and Deer Movement: Why Generic Lunar Calendars Fail — and What to Do Instead
      </h1>

      <p style={{ fontSize: "18px", color: "#3a2a0a", lineHeight: 1.75, marginBottom: "40px", fontStyle: "italic" }}>
        Pick up any deer hunting magazine and you'll find a lunar calendar tucked inside. And here's the thing — paying attention to moon phase isn't wrong. It's a real variable. The problem is that a generic lunar calendar can't tell you anything meaningful about the specific buck you're trying to kill.
      </p>

      {/* Key Takeaways */}
      <div style={{ backgroundColor: "#fff", borderRadius: "12px", padding: "28px", border: "1px solid #ddd5c0", marginBottom: "36px" }}>
        <h2 style={{ fontFamily: "Georgia, serif", color: "#1a2e0a", fontSize: "16px", marginBottom: "12px", marginTop: 0 }}>Key Takeaways</h2>
        <ul style={{ color: "#3a2a0a", lineHeight: 1.8, paddingLeft: "20px", margin: 0 }}>
          <li>Moon phase is a legitimate variable — but population-level studies can't tell you how <strong>YOUR buck</strong> responds to it</li>
          <li>Deer are <strong>crepuscular by nature</strong> — dawn and dusk are peak movement times regardless of lunar cycle</li>
          <li>The rut, temperature, and hunting pressure are stronger predictors at the population level — but your buck may pattern differently</li>
          <li>A 2006 study found a real uptick in midday movement during full moons — your deer might do the same</li>
          <li>Your individual buck's <strong>trail cam data is the only way</strong> to know whether moon phase actually matters for him</li>
        </ul>
      </div>

      <h2 style={s.h2}>Why Generic Moon Calendars Don't Work</h2>
      <p style={s.body}>
        That lunar calendar was built on population-level data — hundreds of deer averaged across different regions, habitat types, and age classes. When you pool all that together, individual signals get washed out. That doesn't mean no deer responds to the moon. It means the average deer doesn't show a clean, consistent pattern.
      </p>
      <p style={s.body}>
        Multiple large-scale GPS studies confirm this. Penn State tracked GPS-collared deer across two full seasons and found moon phase had an insignificant effect on movement at the population level — deer moved roughly 6 meters more per hour under a new moon versus a full moon, a difference researchers described as biologically negligible. NC State compiled over 22,000 GPS fixes and found the same result. The MSU Deer Lab tracked 48 collared bucks and found just 4 extra yards per hour on the highest-rated solunar day.
      </p>
      <p style={s.body}>
        But here's what every hunter should pull from that research: <strong>a 2006 <em>Journal of Wildlife Management</em> study did find a real, measurable uptick in midday movement during full moon periods.</strong> It wasn't dramatic — but it was there. Which means some deer, under some conditions, respond to a full moon in a way you can detect. Your buck might be one of them. You won't know from a generic calendar.
      </p>
      <p style={s.body}>
        The honest takeaway from the science isn't "moon phase doesn't matter." It's that population-level research can't make a reliable prediction for your specific deer. That's a different conclusion — and it points toward a different solution.
      </p>

      <h2 style={s.h2}>What Actually Drives Movement</h2>
      <p style={s.body}>At the population level, the research is consistent. These are the variables that show up as statistically significant across thousands of deer-days of GPS data:</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "32px" }}>
        {[
          { title: "The Rut", body: "Bucks travel ~2x farther per hour at peak breeding. The most consistent movement driver in all research. Nothing overrides it." },
          { title: "Time of Day", body: "Dawn and dusk are peak movement times in every major study. Regardless of moon phase, season, or weather, this doesn't change." },
          { title: "Hunting Pressure", body: "GPS studies show deer shift toward nocturnal behavior almost immediately after being hunted. Intrusion matters more than most hunters realize." },
          { title: "Temperature", body: "The most reliable weather-related trigger. Cold fronts dropping temps 15°F+ consistently pull deer to their feet in daylight." },
        ].map((card) => (
          <div key={card.title} style={{ backgroundColor: "#fff", borderRadius: "8px", padding: "20px", border: "1px solid #ddd5c0" }}>
            <h4 style={{ color: "#2d5016", fontFamily: "Georgia, serif", marginBottom: "8px", fontSize: "16px", marginTop: 0 }}>{card.title}</h4>
            <p style={{ color: "#3a2a0a", fontSize: "14px", lineHeight: 1.65, margin: 0 }}>{card.body}</p>
          </div>
        ))}
      </div>

      <p style={s.body}>
        None of this means moon phase is irrelevant. It means it's not the dominant variable at the population level. It could still be the variable that explains why your particular buck shows up on a Tuesday afternoon instead of a Thursday morning — but you won't find that out from a magazine lunar calendar.
      </p>

      <h2 style={s.h2}>The Real Problem with Generic Lunar Calendars</h2>
      <p style={s.body}>
        Here's the core issue: a generic moon calendar was built on population-level assumptions, or on anecdote, or on regional data that has nothing to do with your property. A "peak movement day" might correlate with heightened activity in an Iowa farm field during a cold October. It might mean nothing to the 4.5-year-old buck bedding in a nasty creek bottom on your property in Alabama.
      </p>
      <p style={s.body}>
        Mature bucks develop highly individual routines. They respond to their specific food sources, bedding cover, and pressure history — in ways that get more idiosyncratic as they age. A buck that survived three seasons of hunting pressure didn't do it by following a predictable schedule that matches the almanac.
      </p>
      <p style={s.body}>
        Generic lunar calendars also encourage hunters to stay home on "bad moon" days and hunt hard on "peak moon" days — regardless of wind, temperature, or what their trail cams are actually showing. That's backwards. You should be hunting when YOUR deer is moving in daylight, not when a calendar says deer in general might be moving.
      </p>

      <h2 style={s.h2}>Pattern Your Buck — That's the Only Approach That Works</h2>
      <p style={s.body}>
        If moon phase matters for your deer — and it might — you'll only find out by building a data set on that specific animal. Trail cameras are your instrument. Every daylight photo of a target buck is a data point. Over a season, patterns emerge that no general study and no generic calendar can reveal.
      </p>
      <p style={s.body}>
        Log every daylight photo with date, time, temperature, wind direction, and moon phase. Look for clusters across multiple photos. Stack variables — the most productive sits align multiple favorable conditions at once. Give it multiple seasons and you'll notice things no population study could tell you: that this deer goes dark when temps are above 60°F in October, or that he's on his feet mid-morning the week after a full moon.
      </p>
      <p style={s.body}>
        That's the data that gives you an actual edge. Not a generalized lunar calendar built on deer hundreds of miles away from your property.
      </p>

      {/* Studies */}
      <h2 style={s.h2}>The Studies in Detail</h2>

      <h3 style={s.h3}>Penn State Deer-Forest Study</h3>
      <p style={s.body}>Penn State surveyed 1,680 hunters and simultaneously tracked GPS-collared deer across two October seasons. Their finding: deer moved roughly 6 meters more per hour under a new moon versus a full moon — described as biologically negligible. Peak activity occurred within two hours of sunrise and sunset regardless of moon phase.</p>
      <p style={s.cite}>Source: <a href="https://www.deer.psu.edu/wandering-in-the-moonlight/" target="_blank" rel="noopener noreferrer" style={{ color: "#2d5016" }}>Penn State Deer-Forest Study, "Wandering in the Moonlight" (2017)</a></p>

      <h3 style={s.h3}>NC State / Marcus Lashley Study</h3>
      <p style={s.body}>Lashley compiled over 22,000 GPS fixes and correlated activity to moon phases. Deer moved most at dawn and dusk regardless of moon phase. A slight midday increase was observed during full moons — minor, but real. Deer movements were slightly greater at dawn during new moons.</p>
      <p style={s.cite}>Source: <a href="https://seafwa.org/journal/2016/movement-moon-white-tailed-deer-activity-and-solunar-events" target="_blank" rel="noopener noreferrer" style={{ color: "#2d5016" }}>Lashley et al., Journal of the Southeastern Association of Fish and Wildlife Agencies (2016)</a></p>

      <h3 style={s.h3}>Mississippi State University Deer Lab (2025)</h3>
      <p style={s.body}>The MSU Deer Lab tracked 48 collared bucks September through February. On the best possible solunar rating, bucks moved just 4 extra yards per hour with essentially no change in bedding time. As researcher Luke Resop noted: <em>"This is essentially the data you expect to see when there's no effect in a study."</em></p>
      <p style={s.cite}>Source: <a href="https://www.themeateater.com/wired-to-hunt/whitetail-hunting/new-research-confirms-the-moon-doesnt-affect-deer-movement" target="_blank" rel="noopener noreferrer" style={{ color: "#2d5016" }}>MeatEater / MSU Deer Lab (2025)</a></p>

      <h3 style={s.h3}>King Ranch Study (Dr. Mickey Hellickson)</h3>
      <p style={s.body}>Hellickson tracked 43 bucks on the King Ranch recording over 420,000 GPS locations from October through January. His conclusion:</p>
      <blockquote style={s.bq}>"Although the moon may influence buck movements in other ways, our data did not indicate any patterns relative to the effects of moon phase on buck movements."</blockquote>
      <p style={s.cite}>Source: <a href="https://bowhuntersunited.com/2025/12/10/moon-affect-deer/" target="_blank" rel="noopener noreferrer" style={{ color: "#2d5016" }}>Bowhunters United / Archery Trade Association (2025)</a></p>

      {/* CTA */}
      <div style={{ backgroundColor: "#2d5016", borderRadius: "12px", padding: "36px", textAlign: "center", color: "#fff", marginTop: "48px" }}>
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "22px", marginBottom: "12px", marginTop: 0 }}>Find Your Buck's Actual Pattern</h2>
        <p style={{ color: "#c8e6a0", fontSize: "15px", marginBottom: "24px", maxWidth: "480px", margin: "0 auto 24px" }}>
          DeerStats reads the timestamps from your trail cam photos, matches them to real weather and moon data, and tells you exactly what conditions your buck has been showing up in — then forecasts your best upcoming dates based on his pattern.
        </p>
        <Link href="/" style={{ backgroundColor: "#8bc34a", color: "#1a2e0a", padding: "14px 28px", borderRadius: "8px", textDecoration: "none", fontWeight: 700, fontSize: "15px", display: "inline-block" }}>
          Try Your First Report Free
        </Link>
      </div>

      {/* Related */}
      <div style={{ marginTop: "48px" }}>
        <h3 style={{ fontFamily: "Georgia, serif", fontSize: "18px", color: "#1a2e0a", marginBottom: "16px" }}>Related Articles</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <Link href="/blog/weather-barometric-pressure-deer-hunting" style={{ color: "#2d5016", textDecoration: "none", fontSize: "15px", fontWeight: 500 }}>→ Weather & Barometric Pressure: The Real Science Behind Deer Movement</Link>
          <Link href="/blog/how-to-analyze-trail-camera-photos" style={{ color: "#2d5016", textDecoration: "none", fontSize: "15px", fontWeight: 500 }}>→ How to Analyze Your Trail Camera Photos to Find Your Best Days to Hunt</Link>
        </div>
      </div>
    </main>
  );
}
