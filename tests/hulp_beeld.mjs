// Hulp voor tests: het verhaalbeeld heeft sinds 0.77.4 een knop "Continue to level"
// die na 10 seconden verschijnt. Deze hulp tikt die knop zodra hij er is,
// zodat tests die het beeld alleen willen passeren gewoon doorlopen.
export async function autoVerder(p) {
  await p.addInitScript(() => {
    const tik = () => { const k = document.getElementById('verhaalbeeld-verder'); if (k && !k.hidden) k.click(); };
    window.setInterval(tik, 100);
  });
}
