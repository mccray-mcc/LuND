/* LuND — borough data
   Merged from:
   - all_33_boroughs_noise_percentages.csv  (road / rail / industry share of residents at Lden >= 55 dB)
   - Deciple_Comparsion.csv                  (average dB + real-world comparison)
   - green_cover_borough_summary_0.05.xlsx   (GLA green & blue cover, NDVI 0.05 threshold)
   c = fallback centroid [lng, lat], used only if the OSM borough outlines can't load. */
window.LUND_DATA = (function () {
  const B = [
    // key, name, db, comparison, road%, rail%, ind%, roadPop, railPop, green%, blue%, areaHa, greenHa, centroid
    ['barking and dagenham', 'Barking & Dagenham', 62.4, 'Normal Conversation', 12.17, 0.97, 0.30, 216700, 17300, 39.20, 6.10, 3779.9, 1481.8, [0.1293, 51.5465]],
    ['barnet', 'Barnet', 60.8, 'Normal Conversation', 17.80, 4.12, 0.16, 45400, 10500, 57.99, 0.69, 8674.8, 5030.9, [-0.2000, 51.6150]],
    ['bexley', 'Bexley', 62.9, 'Normal Conversation', 13.49, 2.68, 0.11, 85000, 16900, 42.92, 6.81, 6428.6, 2759.1, [0.1480, 51.4570]],
    ['brent', 'Brent', 61.9, 'Normal Conversation', 24.40, 1.39, 0.66, 388000, 22100, 39.94, 1.03, 4323.3, 1726.6, [-0.2650, 51.5600]],
    ['bromley', 'Bromley', 61.2, 'Normal Conversation', 27.12, 3.52, 0.08, 169500, 22000, 68.36, 0.38, 15013.5, 10262.6, [0.0390, 51.3720]],
    ['camden', 'Camden', 61.6, 'Normal Conversation', 21.97, 1.87, 0.27, 156000, 13300, 43.28, 0.91, 2178.9, 943.0, [-0.1600, 51.5470]],
    ['city of london', 'City of London', 61.6, 'Normal Conversation', 34.23, 2.08, 0.42, 823200, 50100, 5.59, 7.72, 314.9, 17.6, [-0.0922, 51.5155]],
    ['croydon', 'Croydon', 60.3, 'Normal Conversation', 12.14, 2.66, 0.08, 44300, 9700, 55.53, 0.13, 8649.4, 4802.8, [-0.0870, 51.3650]],
    ['ealing', 'Ealing', 60.6, 'Normal Conversation', 18.63, 4.35, 0.00, 47500, 11100, 43.96, 0.94, 5554.4, 2441.7, [-0.3200, 51.5200]],
    ['enfield', 'Enfield', 60.1, 'Normal Conversation', 16.56, 2.44, 0.26, 102700, 15100, 52.95, 5.16, 8220.0, 4352.7, [-0.0820, 51.6500]],
    ['greenwich', 'Greenwich', 61.5, 'Normal Conversation', 21.64, 2.22, 0.18, 156900, 16100, 43.22, 6.78, 5044.2, 2180.1, [0.0500, 51.4700]],
    ['hackney', 'Hackney', 64.1, 'Loud Office', 14.88, 2.76, 0.12, 74400, 13800, 38.79, 2.23, 1904.9, 739.0, [-0.0600, 51.5480]],
    ['hammersmith and fulham', 'Hammersmith & Fulham', 63.5, 'Conversation at 3ft', 16.48, 2.21, 0.28, 23900, 3200, 27.60, 4.63, 1715.4, 473.4, [-0.2250, 51.4960]],
    ['haringey', 'Haringey', 61.2, 'Normal Conversation', 22.16, 2.44, 0.49, 139600, 15400, 43.55, 0.79, 2959.8, 1288.9, [-0.1050, 51.5880]],
    ['harrow', 'Harrow', 60.0, 'Background Music', 47.00, 3.25, 0.19, 75200, 5200, 55.42, 0.47, 5046.3, 2796.6, [-0.3350, 51.5900]],
    ['havering', 'Havering', 61.1, 'Normal Conversation', 24.64, 1.72, 0.61, 258700, 18100, 65.98, 3.51, 11445.7, 7552.0, [0.2350, 51.5580]],
    ['hillingdon', 'Hillingdon', 63.4, 'Conversation at 3ft', 12.71, 1.18, 0.59, 32400, 3000, 54.60, 3.26, 11570.1, 6316.8, [-0.4500, 51.5350]],
    ['hounslow', 'Hounslow', 61.3, 'Normal Conversation', 26.88, 4.56, 0.24, 266100, 45100, 47.31, 3.15, 5658.5, 2677.2, [-0.3800, 51.4680]],
    ['islington', 'Islington', 61.9, 'Normal Conversation', 20.87, 0.71, 0.36, 140900, 4800, 34.88, 0.27, 1485.7, 518.1, [-0.1100, 51.5470]],
    ['kensington and chelsea', 'Kensington & Chelsea', 64.1, 'Loud Office', 14.70, 2.70, 0.43, 16900, 3100, 30.37, 2.31, 1238.4, 376.1, [-0.1940, 51.5000]],
    ['kingston upon thames', 'Kingston upon Thames', 63.9, 'Conversation at 3ft', 13.17, 0.73, 0.00, 27000, 1500, 52.42, 1.05, 3726.1, 1953.4, [-0.2870, 51.3900]],
    ['lambeth', 'Lambeth', 60.8, 'Normal Conversation', 40.37, 2.83, 0.12, 131200, 9200, 32.91, 1.62, 2724.9, 896.8, [-0.1170, 51.4600]],
    ['lewisham', 'Lewisham', 63.0, 'Normal Conversation', 16.50, 4.25, 0.31, 26400, 6800, 40.25, 0.80, 3531.7, 1421.5, [-0.0180, 51.4450]],
    ['merton', 'Merton', 63.9, 'Conversation at 3ft', 10.00, 3.47, 0.47, 15000, 5200, 48.78, 0.85, 3762.5, 1835.4, [-0.1900, 51.4100]],
    ['newham', 'Newham', 61.4, 'Normal Conversation', 28.37, 2.16, 0.49, 689300, 52400, 30.64, 9.46, 3857.8, 1182.1, [0.0300, 51.5250]],
    ['redbridge', 'Redbridge', 62.0, 'Normal Conversation', 18.30, 2.30, 0.35, 84200, 10600, 53.56, 1.41, 5644.2, 3023.2, [0.0700, 51.5800]],
    ['richmond upon thames', 'Richmond upon Thames', 63.6, 'Conversation at 3ft', 17.94, 2.00, 0.00, 27800, 3100, 61.99, 5.24, 5876.1, 3642.7, [-0.3150, 51.4400]],
    ['southwark', 'Southwark', 61.2, 'Normal Conversation', 23.03, 2.21, 0.28, 269500, 25800, 37.67, 4.23, 2991.3, 1126.7, [-0.0750, 51.4700]],
    ['sutton', 'Sutton', 64.1, 'Loud Office', 11.66, 2.12, 0.16, 89200, 16200, 49.69, 1.25, 4384.7, 2178.8, [-0.1900, 51.3600]],
    ['tower hamlets', 'Tower Hamlets', 61.8, 'Normal Conversation', 23.52, 1.84, 0.51, 192900, 15100, 25.38, 11.75, 2157.5, 547.6, [-0.0300, 51.5150]],
    ['waltham forest', 'Waltham Forest', 61.8, 'Normal Conversation', 36.32, 3.28, 0.00, 45400, 4100, 44.36, 6.24, 3880.8, 1721.3, [-0.0150, 51.5900]],
    ['wandsworth', 'Wandsworth', 61.9, 'Normal Conversation', 25.00, 1.52, 0.07, 152500, 9300, 39.01, 3.20, 3522.0, 1373.9, [-0.2000, 51.4550]],
    ['westminster', 'Westminster', 64.1, 'Loud Office / Background TV', 25.67, 5.65, 0.25, 2387200, 525200, 31.20, 4.41, 2203.0, 687.3, [-0.1500, 51.5120]],
  ];

  const boroughs = {};
  for (const r of B) {
    boroughs[r[0]] = {
      key: r[0], name: r[1], db: r[2], cmp: r[3], road: r[4], rail: r[5], ind: r[6],
      roadPop: r[7], railPop: r[8], green: r[9], blue: r[10], areaHa: r[11], greenHa: r[12], c: r[13],
    };
  }

  // OSM relation names → our keys ("London Borough of Camden", "City of Westminster", ...)
  function keyFromName(name) {
    if (!name) return null;
    let k = name.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
    if (k === 'city of london') return k;
    k = k.replace(/^(the )?(london borough of|royal borough of|city of)\s+/, '');
    return boroughs[k] ? k : null;
  }

  let area = 0, green = 0;
  for (const k in boroughs) { area += boroughs[k].areaHa; green += boroughs[k].greenHa; }

  return {
    boroughs, keyFromName,
    londonGreenPct: (green / area) * 100,
    list: Object.values(boroughs),
  };
})();
