/**
 * NAIOSH UNIVERSAL SECTOR OPPORTUNITY ENGINE
 * نواة واحدة + Sector Configuration — بدون محركات قطاعية منفصلة.
 */
(() => {
  'use strict';

  const lib = () => window.HubSectorLibrary;
  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const normalize = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/[^\u0600-\u06FFa-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const tokenize = (s) => normalize(s).split(' ').filter((t) => t.length > 1);

  const scoreConfidence = ({ skillHit, resourceHit, marketHit, experience, risk }) => {
    let n = 42;
    n += Math.min(28, skillHit * 9);
    n += marketHit ? 12 : 0;
    n += resourceHit ? 8 : 0;
    if (experience === 'خبير') n += 10;
    else if (experience === 'متوسط') n += 6;
    else n += 2;
    if (risk === 'منخفض' || risk === 'منخفض جدًا') n += 8;
    else if (risk === 'مرتفع') n -= 10;
    return Math.max(35, Math.min(97, Math.round(n)));
  };

  const runGate = (opp, profile = {}) => {
    const skills = (profile.skills || '').toString();
    const needSkills = opp.skills || [];
    const missing = needSkills.filter((sk) => !normalize(skills).includes(normalize(sk)));
    if ((opp.risk === 'مرتفع' || opp.risk === 'عالي') && !profile.acceptHighRisk) {
      return { status: 'HIGH_RISK_RESTRICTED', labelAr: 'مخاطر مرتفعة / مقيّد', missing };
    }
    if ((opp.licenses || []).length && !profile.hasLicense) {
      return { status: 'NEEDS_LICENSE', labelAr: 'يحتاج ترخيص', missing };
    }
    if (missing.length >= 2) {
      return { status: 'NEEDS_TRAINING', labelAr: 'يحتاج تدريب', missing };
    }
    if ((opp.partnersNeeded || false) && !profile.hasPartner) {
      return { status: 'NEEDS_PARTNER', labelAr: 'يحتاج شريك', missing };
    }
    if (missing.length === 1) {
      return { status: 'NEEDS_TRAINING', labelAr: 'يحتاج تدريب خفيف', missing };
    }
    return { status: 'READY', labelAr: 'جاهز للاختبار', missing: [] };
  };

  const templatesFromSector = (sector) =>
    (sector.opportunityTemplates || []).map((t) => ({
      ...t,
      sectorId: sector.sectorId,
      sectorNameAr: sector.sectorNameAr,
      licenses: sector.licenses || [],
      safetyRisks: sector.safetyRisks || [],
      type: 'sector-template',
    }));

  const allTemplates = () => {
    const L = lib();
    if (!L) return [];
    return L.list().flatMap(templatesFromSector);
  };

  const discoverSectorsFromText = (query) => {
    const L = lib();
    if (!L) return [];
    const q = normalize(query);
    const tokens = tokenize(query);
    const scored = L.list()
      .filter((s) => s.sectorId !== 'other')
      .map((s) => {
        let score = 0;
        const bag = [
          s.sectorNameAr,
          s.sectorName,
          ...(s.subSectors || []),
          ...(s.skills || []),
          ...(s.occupations || []),
          ...(s.marketNeeds || []),
          ...(s.services || []),
        ]
          .map(normalize)
          .join(' ');
        tokens.forEach((t) => {
          if (bag.split(' ').includes(t)) score += 4;
          else if (bag.indexOf(t) >= 0) score += 2;
        });
        // ontology boost
        Object.entries(L.SKILL_ONTOLOGY || {}).forEach(([skill, ids]) => {
          if (q.includes(normalize(skill)) && ids.includes(s.sectorId)) score += 6;
        });
        if (q.includes(normalize(s.sectorNameAr)) || q.includes(normalize(s.sectorName))) score += 10;
        return { sector: s, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored;
  };

  const crossSectorIdeas = (sectorIds = []) => {
    const L = lib();
    if (!L) return [];
    const set = new Set(sectorIds);
    return (L.COMBINATIONS || [])
      .filter((c) => set.has(c.a) || set.has(c.b) || sectorIds.length === 0)
      .map((c) => {
        const a = L.get(c.a);
        const b = L.get(c.b);
        return {
          id: `cross-${c.a}-${c.b}`,
          titleAr: c.titleAr,
          sectorIds: [c.a, c.b],
          sectorNamesAr: [a?.sectorNameAr, b?.sectorNameAr].filter(Boolean),
          type: 'cross-sector',
          skills: [...new Set([...(a?.skills || []).slice(0, 2), ...(b?.skills || []).slice(0, 2)])],
          risk: 'متوسط',
          capital: 'منخفض',
        };
      });
  };

  /**
   * Universal Discovery — المستخدم يكتب جملة طبيعية.
   */
  const discover = (query, profile = {}) => {
    const L = lib();
    if (!L) return { sectors: [], opportunities: [], cycle: L?.CYCLE || [] };
    const q = normalize(query);
    const sectorHits = discoverSectorsFromText(query);
    const topSectorIds = sectorHits.slice(0, 4).map((x) => x.sector.sectorId);

    const fromTemplates = allTemplates()
      .map((t) => {
        const skillHit = (t.skills || []).filter((sk) => q.includes(normalize(sk)) || normalize(profile.skills || '').includes(normalize(sk))).length;
        const marketHit = (lib().get(t.sectorId)?.marketNeeds || []).some((m) => q.includes(normalize(m)));
        const inTop = topSectorIds.includes(t.sectorId);
        let base = inTop ? 8 : 0;
        base += skillHit * 6;
        if (normalize(t.titleAr).split(' ').some((w) => q.includes(w) && w.length > 2)) base += 5;
        const confidence = scoreConfidence({
          skillHit: skillHit || (inTop ? 1 : 0),
          resourceHit: (t.resources || []).length > 0,
          marketHit: marketHit || inTop,
          experience: profile.experience,
          risk: t.risk,
        });
        const gate = runGate(t, profile);
        return { ...t, score: base + confidence / 10, confidence, gate };
      })
      .filter((t) => t.score > 5 || topSectorIds.includes(t.sectorId))
      .sort((a, b) => b.confidence - a.confidence || b.score - a.score);

    const crosses = crossSectorIdeas(topSectorIds.length ? topSectorIds : sectorHits.slice(0, 2).map((x) => x.sector.sectorId))
      .map((c) => {
        const confidence = scoreConfidence({
          skillHit: 1,
          resourceHit: true,
          marketHit: true,
          experience: profile.experience,
          risk: c.risk,
        });
        const gate = runGate(c, profile);
        return { ...c, score: 7 + confidence / 12, confidence, gate };
      });

    // fallback: if no text match, surface featured templates + crosses
    let opportunities = [...fromTemplates, ...crosses].sort((a, b) => b.confidence - a.confidence);
    if (!q && opportunities.length === 0) {
      opportunities = allTemplates()
        .slice(0, 8)
        .map((t) => ({
          ...t,
          confidence: scoreConfidence({ skillHit: 1, resourceHit: true, marketHit: true, experience: profile.experience, risk: t.risk }),
          gate: runGate(t, profile),
        }));
    }

    return {
      query,
      sectors: sectorHits.slice(0, 6).map((x) => ({
        id: x.sector.sectorId,
        nameAr: x.sector.sectorNameAr,
        nameEn: x.sector.sectorName,
        icon: x.sector.icon,
        score: x.score,
        subSectors: x.sector.subSectors || [],
      })),
      opportunities: opportunities.slice(0, 12),
      cycle: L.CYCLE,
      ontologyHits: Object.keys(L.SKILL_ONTOLOGY || {}).filter((k) => q.includes(normalize(k))),
    };
  };

  const commandCenterStats = () => {
    const L = lib();
    if (!L) return {};
    const sectors = L.list().filter((s) => s.sectorId !== 'other');
    const skills = new Set();
    const projects = [];
    sectors.forEach((s) => {
      (s.skills || []).forEach((x) => skills.add(x));
      (s.opportunityTemplates || []).forEach((t) => projects.push(t));
    });
    return {
      sectors: sectors.length,
      subSectors: sectors.reduce((n, s) => n + (s.subSectors || []).length, 0),
      skills: skills.size,
      opportunities: projects.length,
      combinations: (L.COMBINATIONS || []).length,
      cycleSteps: (L.CYCLE || []).length,
    };
  };

  const publishSector = (pkg) => {
    const L = lib();
    if (!L) throw new Error('Sector library missing');
    const item = L.emptyPackage({ ...pkg, published: true });
    if (!item.sectorId || !item.sectorNameAr) throw new Error('Sector ID and Arabic name required');
    const existing = L.SECTORS.findIndex((s) => s.sectorId === item.sectorId);
    if (existing >= 0) L.SECTORS[existing] = { ...L.SECTORS[existing], ...item };
    else L.SECTORS.splice(L.SECTORS.length - 1, 0, item); // before "other"
    try {
      const custom = JSON.parse(localStorage.getItem('naiosh_custom_sectors') || '[]');
      const next = custom.filter((c) => c.sectorId !== item.sectorId).concat([item]);
      localStorage.setItem('naiosh_custom_sectors', JSON.stringify(next));
    } catch (_) {}
    return item;
  };

  const loadCustomSectors = () => {
    const L = lib();
    if (!L) return;
    try {
      const custom = JSON.parse(localStorage.getItem('naiosh_custom_sectors') || '[]');
      custom.forEach((item) => {
        if (!item?.sectorId) return;
        const i = L.SECTORS.findIndex((s) => s.sectorId === item.sectorId);
        if (i >= 0) L.SECTORS[i] = { ...L.SECTORS[i], ...item };
        else L.SECTORS.splice(Math.max(0, L.SECTORS.length - 1), 0, item);
      });
    } catch (_) {}
  };

  window.HubUniversalOpportunityEngine = {
    discover,
    runGate,
    scoreConfidence,
    crossSectorIdeas,
    commandCenterStats,
    publishSector,
    loadCustomSectors,
    allTemplates,
    esc,
  };

  loadCustomSectors();
})();
