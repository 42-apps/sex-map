/* ============================================================================
   World Sex Map — perspectives (metrics), the history-of-sexuality timeline,
   global trends, and the time axis.
   ----------------------------------------------------------------------------
   window.METRICS      — the map "perspectives": each colours the world by one
                         dimension of human sexuality. kind drives the scale:
                           'gyr'  green→yellow→red (low→high; high is "worse")
                           'warm'|'blue'|'teal'|'purple'  sequential (dim→bright)
                           'cat'  categorical (uses .cats colours)
                         subjective:true marks a metric that is opinion, not fact.
   window.EVENT_CATS   — categories for the history timeline (colour per kind).
   window.SEX_EVENTS   — milestones in the history of sexuality (year<0 = BCE).
   window.TRENDS       — global time-series (age at first sex, partners, …).
   window.TIME_SLICES  — the timeline's anchors (3000 BCE → today).

   Country data lives in data/sex-data.js (window.COUNTRY_DATA[ISO2]).
   ⚠️ Much of this data is self-reported survey data — patchy, dated and
   methodologically variable. Treat cross-country comparisons as indicative.
   ========================================================================== */
'use strict';

window.METRICS = {
  sexFrequency:  { field: 'sexFrequency', label: 'Sex frequency', short: 'Frequency', unit: '/yr', kind: 'warm', domain: [50, 130], fmt: 'int', desc: 'Average times per year a sexually active adult has sex (survey estimates)' },
  satisfaction:  { field: 'satisfaction', label: 'Sexual satisfaction', short: 'Satisfaction', unit: '%', kind: 'teal', domain: [30, 90], fmt: 'pct0', desc: '% of adults satisfied with their sex life' },
  partners:      { field: 'partners', label: 'Lifetime partners', short: 'Partners', unit: '', kind: 'warm', domain: [2, 14], fmt: 'dec1', desc: 'Average lifetime number of sexual partners (self-reported)' },
  ageFirstSex:   { field: 'ageFirstSex', label: 'Age at first sex', short: 'First sex', unit: ' yrs', kind: 'purple', domain: [15, 23], fmt: 'dec1', desc: 'Median age at first sexual intercourse' },
  openness:      { field: 'openness', label: 'Sexual openness', short: 'Openness', unit: '', kind: 'blue', domain: [10, 90], fmt: 'int', desc: 'Openness index — acceptance of premarital & casual sex and homosexuality (higher = more liberal)' },
  premaritalOk:  { field: 'premaritalOk', label: 'Premarital sex accepted', short: 'Premarital', unit: '%', kind: 'blue', domain: [10, 95], fmt: 'pct0', desc: '% who say sex before marriage is acceptable' },
  lgbtAcceptance:{ field: 'lgbtAcceptance', label: 'LGBT acceptance', short: 'LGBT', unit: '%', kind: 'blue', domain: [5, 90], fmt: 'pct0', desc: '% who say homosexuality should be accepted by society' },
  perceivedAttractiveness: { field: 'perceivedAttractiveness', label: 'Perceived attractiveness', short: 'Attractiveness', unit: '', kind: 'purple', domain: [40, 90], fmt: 'int', subjective: true, desc: '⚠ Subjective — how attractive a country’s people are perceived to be in opinion / self-rating polls. NOT an objective measure; it largely reflects stereotypes and media exposure.' },
  infidelity:    { field: 'infidelity', label: 'Infidelity', short: 'Infidelity', unit: '%', kind: 'gyr', domain: [10, 55], fmt: 'pct0', good: 'low', desc: '% of adults who admit to having had an affair (self-reported)' },
  pornInterest:  { field: 'pornInterest', label: 'Porn interest', short: 'Porn', unit: '', kind: 'warm', domain: [20, 100], fmt: 'int', desc: 'Relative porn-interest index (Pornhub per-capita traffic / search interest; highest ≈ 100)' },
  contraception: { field: 'contraception', label: 'Contraceptive use', short: 'Contraception', unit: '%', kind: 'teal', domain: [10, 80], fmt: 'pct0', desc: '% of women aged 15–49 using any contraceptive method' },
  condomUse:     { field: 'condomUse', label: 'Condom use', short: 'Condoms', unit: '%', kind: 'teal', domain: [10, 80], fmt: 'pct0', desc: '% condom use at last higher-risk sex (or best available adult figure)' },
  hivPrevalence: { field: 'hivPrevalence', label: 'HIV prevalence', short: 'HIV', unit: '%', kind: 'gyr', domain: [0, 15], fmt: 'dec1', good: 'low', desc: '% of adults aged 15–49 living with HIV' },
  teenBirthRate: { field: 'teenBirthRate', label: 'Teen birth rate', short: 'Teen births', unit: '', kind: 'gyr', domain: [0, 120], fmt: 'int', good: 'low', desc: 'Births per 1,000 women aged 15–19' },
  ageOfConsent:  { field: 'ageOfConsent', label: 'Age of consent', short: 'Consent age', unit: ' yrs', kind: 'blue', domain: [13, 18], fmt: 'int', desc: 'Legal age of sexual consent' },
  prostitution:  { field: 'prostitutionStatus', label: 'Prostitution legality', short: 'Prostitution', kind: 'cat', desc: 'Legal status of prostitution (sex work)',
    cats: { legal: { label: 'Legal & regulated', color: '#2fa84f' }, limited: { label: 'Limited / restricted', color: '#e0a92f' }, illegal: { label: 'Illegal', color: '#c0392b' } } },
};
window.METRIC_ORDER = ['sexFrequency', 'satisfaction', 'partners', 'ageFirstSex', 'openness', 'premaritalOk', 'lgbtAcceptance', 'perceivedAttractiveness', 'infidelity', 'pornInterest', 'contraception', 'condomUse', 'hivPrevalence', 'teenBirthRate', 'ageOfConsent', 'prostitution'];

window.EVENT_CATS = {
  ancient:       { label: 'Ancient world',      color: '#b08a3a' },
  religion:      { label: 'Religion & morality', color: '#9b6fd0' },
  science:       { label: 'Sex research',       color: '#2fa8a0' },
  law:           { label: 'Law & rights',       color: '#2f6fe0' },
  medicine:      { label: 'Medicine & health',  color: '#e0568f' },
  contraception: { label: 'Contraception',      color: '#3fae6a' },
  lgbt:          { label: 'LGBT history',       color: '#e0962f' },
  liberation:    { label: 'Sexual revolution',  color: '#c0392b' },
  media:         { label: 'Media & culture',    color: '#5e8bef' },
};

window.TIME_SLICES = [
  { id: '-3000', label: '3000 BCE', era: 'ancient' },
  { id: '-1000', label: '1000 BCE', era: 'ancient' },
  { id: '-400',  label: '400 BCE',  era: 'classical' },
  { id: '1',     label: '1 CE',     era: 'classical' },
  { id: '500',   label: '500 CE',   era: 'medieval' },
  { id: '1000',  label: '1000',     era: 'medieval' },
  { id: '1450',  label: '1450',     era: 'medieval' },
  { id: '1600',  label: '1600',     era: 'earlymodern' },
  { id: '1750',  label: '1750',     era: 'earlymodern' },
  { id: '1850',  label: '1850',     era: 'modern' },
  { id: '1900',  label: '1900',     era: 'modern' },
  { id: '1930',  label: '1930',     era: 'modern' },
  { id: '1960',  label: '1960',     era: 'contemporary' },
  { id: '1980',  label: '1980',     era: 'contemporary' },
  { id: '2000',  label: '2000',     era: 'contemporary' },
  { id: '2025',  label: 'today',    era: 'contemporary' },
];

window.SEX_EVENTS = [
  { id: 'fertility', year: -3000, title: 'Fertility cults & sacred sexuality', place: 'Ancient Near East', iso: 'IQ', lat: 32.0, lng: 44.4, cat: 'ancient', blurb: 'Across the ancient Near East, sexuality was woven into religion — mother-goddess cults, sacred-marriage rites and frank erotic imagery.', src: ['Archaeology'] },
  { id: 'gilgamesh', year: -2100, title: 'Epic of Gilgamesh — Shamhat', place: 'Sumer', iso: 'IQ', lat: 31.3, lng: 45.6, cat: 'ancient', blurb: 'One of the oldest stories has the temple woman Shamhat use sexuality to civilise the wild man Enkidu — sex as a force of culture.', src: ['Epic of Gilgamesh'] },
  { id: 'levitical', year: -700, title: 'Levitical sexual codes', place: 'Ancient Israel', iso: 'IL', lat: 31.7, lng: 35.2, cat: 'religion', blurb: 'Hebrew law codified sexual prohibitions and purity rules that would shape Jewish, Christian and Islamic ethics for millennia.', src: ['Hebrew Bible'] },
  { id: 'greekeros', year: -400, title: 'Greek eros & pederasty', place: 'Classical Greece', iso: 'GR', lat: 38.0, lng: 23.7, cat: 'ancient', blurb: 'Classical Greece celebrated eros in philosophy and art, with institutionalised age-structured male relationships and an open erotic culture.', src: ['Plato, Symposium'] },
  { id: 'lexiulia', year: -18, title: 'Rome regulates adultery (Lex Iulia)', place: 'Rome', iso: 'IT', lat: 41.9, lng: 12.5, cat: 'law', blurb: 'Augustus criminalised adultery and rewarded marriage and childbearing — an early state attempt to govern private sexual conduct.', src: ['Roman law'] },
  { id: 'kamasutra', year: 300, title: 'Kama Sutra compiled', place: 'India', iso: 'IN', lat: 25.0, lng: 78.0, cat: 'media', blurb: 'Vatsyayana’s Sanskrit treatise frames sexual pleasure (kama) as a legitimate aim of life, with famously detailed guidance.', src: ['Kāma Sūtra'] },
  { id: 'augustine', year: 400, title: 'Augustine & Christian asceticism', place: 'Roman North Africa', iso: 'DZ', lat: 36.8, lng: 7.8, cat: 'religion', blurb: 'Augustine tied sexuality to original sin, cementing a long Christian ideal of chastity and sex-for-procreation only.', src: ['Confessions'] },
  { id: 'islamethics', year: 620, title: 'Islamic sexual ethics', place: 'Arabia', iso: 'SA', lat: 21.4, lng: 39.8, cat: 'religion', blurb: 'Qur’an and hadith set out marital sexual rights and prohibitions, framing sex within marriage as lawful and even virtuous.', src: ['Islamic jurisprudence'] },
  { id: 'courtly', year: 1180, title: 'Courtly love', place: 'France', iso: 'FR', lat: 47.0, lng: 2.0, cat: 'media', blurb: 'Medieval troubadours idealised romantic, often adulterous longing — a new Western script linking love, desire and devotion.', src: ['Andreas Capellanus'] },
  { id: 'syphilis', year: 1495, title: 'Syphilis sweeps Europe', place: 'Naples', iso: 'IT', lat: 40.85, lng: 14.27, cat: 'medicine', blurb: 'A virulent syphilis epidemic reshaped attitudes to sex, prostitution and disease across Renaissance Europe.', src: ['Medical history'] },
  { id: 'condom', year: 1564, title: 'Fallopio describes a condom', place: 'Padua, Italy', iso: 'IT', lat: 45.4, lng: 11.9, cat: 'contraception', blurb: 'Anatomist Gabriele Falloppio described a linen sheath to guard against syphilis — an early documented condom.', src: ['De Morbo Gallico'] },
  { id: 'victorian', year: 1850, title: 'Victorian repression & its underworld', place: 'United Kingdom', iso: 'GB', lat: 51.5, lng: -0.1, cat: 'media', blurb: 'Public prudery coexisted with a vast trade in pornography and prostitution — the era’s contradictions still shape the "Victorian" stereotype.', src: ['Social history'] },
  { id: 'comstock', year: 1873, title: 'Comstock laws ban contraception', place: 'United States', iso: 'US', lat: 38.9, lng: -77.0, cat: 'law', blurb: 'US law banned mailing contraceptives and "obscene" material, criminalising birth-control information for decades.', src: ['Comstock Act'] },
  { id: 'freud', year: 1905, title: 'Freud — Three Essays on Sexuality', place: 'Vienna', iso: 'AT', lat: 48.2, lng: 16.37, cat: 'science', blurb: 'Freud placed sexuality at the centre of the psyche, arguing desire shapes human development from infancy.', src: ['Freud 1905'] },
  { id: 'sanger', year: 1916, title: 'First birth-control clinic', place: 'New York', iso: 'US', lat: 40.67, lng: -73.95, cat: 'contraception', blurb: 'Margaret Sanger opened America’s first birth-control clinic, launching the modern contraception movement — and the term "birth control".', src: ['Planned Parenthood history'] },
  { id: 'hirschfeld', year: 1919, title: 'First institute of sexology', place: 'Berlin', iso: 'DE', lat: 52.5, lng: 13.4, cat: 'science', blurb: 'Magnus Hirschfeld founded the Institut für Sexualwissenschaft, pioneering sexology and early gay-rights advocacy (destroyed by the Nazis in 1933).', src: ['Hirschfeld'] },
  { id: 'kinsey', year: 1948, title: 'Kinsey Reports', place: 'United States', iso: 'US', lat: 39.17, lng: -86.5, cat: 'science', blurb: 'Alfred Kinsey’s surveys revealed how common premarital sex, masturbation and same-sex experience really were — shocking 1950s America.', src: ['Kinsey 1948 / 1953'] },
  { id: 'pill', year: 1960, title: 'The Pill approved', place: 'United States', iso: 'US', lat: 38.9, lng: -77.0, cat: 'contraception', blurb: 'The FDA approved the first oral contraceptive, separating sex from reproduction and helping ignite the sexual revolution.', src: ['FDA 1960'] },
  { id: 'mastersjohnson', year: 1966, title: 'Masters & Johnson — Human Sexual Response', place: 'United States', iso: 'US', lat: 38.6, lng: -90.2, cat: 'science', blurb: 'Laboratory research on the physiology of arousal and orgasm founded modern sex therapy.', src: ['Masters & Johnson 1966'] },
  { id: 'revolution', year: 1967, title: 'The sexual revolution', place: 'Western world', iso: 'US', lat: 37.77, lng: -122.4, cat: 'liberation', blurb: 'Reliable contraception, feminism and youth culture loosened norms around premarital sex, cohabitation and pleasure.', src: ['Social history'] },
  { id: 'stonewall', year: 1969, title: 'Stonewall uprising', place: 'New York', iso: 'US', lat: 40.73, lng: -74.0, cat: 'lgbt', blurb: 'Riots against a police raid on a gay bar galvanised the modern LGBT-rights movement.', src: ['Stonewall'] },
  { id: 'roe', year: 1973, title: 'Roe v. Wade', place: 'United States', iso: 'US', lat: 38.9, lng: -77.0, cat: 'law', blurb: 'The US Supreme Court recognised a constitutional right to abortion (overturned in 2022) — a landmark in reproductive autonomy.', src: ['Roe v. Wade'] },
  { id: 'aids', year: 1981, title: 'HIV/AIDS epidemic begins', place: 'United States', iso: 'US', lat: 34.0, lng: -118.2, cat: 'medicine', blurb: 'The emerging AIDS crisis transformed sexual behaviour, condom use and gay politics worldwide.', src: ['CDC 1981'] },
  { id: 'viagra', year: 1998, title: 'Viagra approved', place: 'United States', iso: 'US', lat: 40.7, lng: -74.0, cat: 'medicine', blurb: 'The first effective oral treatment for erectile dysfunction medicalised male sexuality and became a blockbuster.', src: ['FDA 1998'] },
  { id: 'ssm', year: 2001, title: 'First same-sex marriage', place: 'Netherlands', iso: 'NL', lat: 52.37, lng: 4.9, cat: 'lgbt', blurb: 'The Netherlands became the first country to legalise same-sex marriage; dozens of countries have since followed.', src: ['Dutch law 2001'] },
  { id: 'tubeporn', year: 2007, title: 'Free streaming porn', place: 'Global', iso: 'US', lat: 37.4, lng: -122.0, cat: 'media', blurb: 'Free "tube" sites made pornography ubiquitous and instant, reshaping sexual scripts, expectations and research.', src: ['Industry history'] },
  { id: 'prep', year: 2012, title: 'PrEP approved', place: 'United States', iso: 'US', lat: 38.9, lng: -77.0, cat: 'medicine', blurb: 'A daily pill to prevent HIV transformed sexual-health prospects for people at high risk.', src: ['FDA 2012'] },
  { id: 'datingapps', year: 2012, title: 'Tinder & swipe dating', place: 'United States', iso: 'US', lat: 34.05, lng: -118.24, cat: 'media', blurb: 'Location-based "swipe" apps rewired how a generation meets, dates and has sex.', src: ['Tech history'] },
  { id: 'metoo', year: 2017, title: '#MeToo & consent', place: 'Global', iso: 'US', lat: 40.7, lng: -74.0, cat: 'law', blurb: 'A global reckoning over sexual harassment and consent reshaped norms in workplaces and relationships.', src: ['#MeToo'] },
  { id: 'india377', year: 2018, title: 'India decriminalises gay sex', place: 'India', iso: 'IN', lat: 28.6, lng: 77.2, cat: 'lgbt', blurb: 'India’s Supreme Court struck down Section 377, decriminalising homosexuality for a fifth of humanity.', src: ['Navtej Singh Johar 2018'] },
];

window.TRENDS = {
  ageFirstSex:      [{ year: 1900, value: 19.5 }, { year: 1950, value: 18.8 }, { year: 1970, value: 18.1 }, { year: 1990, value: 17.5 }, { year: 2010, value: 17.2 }, { year: 2024, value: 17.3 }],
  partners:         [{ year: 1900, value: 3.0 }, { year: 1950, value: 3.8 }, { year: 1970, value: 5.2 }, { year: 1990, value: 6.8 }, { year: 2010, value: 8.4 }, { year: 2024, value: 9.0 }],
  premaritalAccept: [{ year: 1900, value: 14 }, { year: 1950, value: 22 }, { year: 1970, value: 45 }, { year: 1990, value: 55 }, { year: 2010, value: 67 }, { year: 2024, value: 72 }],
  contraceptionUse: [{ year: 1900, value: 5 }, { year: 1950, value: 15 }, { year: 1970, value: 38 }, { year: 1990, value: 54 }, { year: 2010, value: 62 }, { year: 2024, value: 65 }],
};
window.TREND_META = {
  ageFirstSex:      { label: 'Age at first sex', color: '#cdb0f0', fmt: 'dec1' },
  partners:         { label: 'Lifetime partners', color: '#ffcf6b', fmt: 'dec1' },
  premaritalAccept: { label: 'Accept premarital sex (%)', color: '#7aa8e0', fmt: 'pct0' },
  contraceptionUse: { label: 'Use contraception (%)', color: '#7ff0c8', fmt: 'pct0' },
};
