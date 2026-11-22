/**
 * @file queryParser.js
 * @brief Natural language query understanding and structured criteria extraction for criminal investigations.
 * Extracts crime category, stolen property, temporal anchors, premises, ignored items, and intent.
 * Engine: Deterministic Rule-Based & Regex Pattern Extractor (Fully Offline, Zero Paid API dependency).
 * @project CASETHREAD
 */

class QueryParser {
  /**
   * Parses natural language question into structured investigative criteria.
   * @param {string} naturalQuery - Investigator query string
   * @param {object} [conversationContext] - Previous conversation turn context
   * @returns {object} Structured criteria object
   */
  static parse(naturalQuery, conversationContext = null) {
    const raw = naturalQuery || '';
    const text = raw.toLowerCase();

    const criteria = {
      rawQuery: naturalQuery,
      engine: 'DETERMINISTIC_INVESTIGATION_PARSER_V1',
      crimeCategories: [],
      stolenProperty: [],
      propertyKeywords: [],
      ignoredItems: [],
      premises: null,
      approximateTime: null,
      targetCountries: [],
      requestedIntent: 'SIMILAR_CASES',
      followUpTarget: null,
      confidence: 1.0
    };

    // 1. Detect follow-up intents referencing previous case
    const isFollowUp = conversationContext && (
      text.includes('that case') ||
      text.includes('the previous case') ||
      text.includes('this case') ||
      text.includes('was it solved') ||
      text.includes('how was it solved') ||
      text.includes('what evidence') ||
      text.includes('did they recover')
    );

    if (isFollowUp) {
      criteria.followUpTarget = conversationContext.lastReferencedCase?.case_reference_number || conversationContext.lastReferencedCase || null;
      if (text.includes('evidence') || text.includes('how') || text.includes('method') || text.includes('steps')) {
        criteria.requestedIntent = 'SOLVED_METHODS';
      } else if (text.includes('recover') || text.includes('property') || text.includes('stolen items')) {
        criteria.requestedIntent = 'RECOVERY_STATUS';
      } else if (text.includes('solved') || text.includes('outcome') || text.includes('verdict')) {
        criteria.requestedIntent = 'OUTCOME_DETAILS';
      }
    }

    // 2. Detect Crime Categories
    if (/\b(?:robbery|robbed|armed\s+robbery|heist|mugging)\b/i.test(text)) criteria.crimeCategories.push('ROBBERY');
    if (/\b(?:burglary|burglarized|break-in|break\s+and\s+enter|forced\s+entry)\b/i.test(text)) criteria.crimeCategories.push('BURGLARY');
    if (/\b(?:theft|stole|stolen|stealing|larceny|shoplifting)\b/i.test(text)) criteria.crimeCategories.push('THEFT');
    if (/\b(?:homicide|murder|manslaughter|killed|slain|fatal)\b/i.test(text)) criteria.crimeCategories.push('HOMICIDE');
    if (/\b(?:cyber|phishing|ransomware|hacking|unauthorized\s+access|api\s+token|data\s+breach)\b/i.test(text)) criteria.crimeCategories.push('CYBERCRIME_AND_FRAUD');
    if (/\b(?:fraud|cheating|embezzlement|wire\s+fraud|financial\s+fraud|scam|mule)\b/i.test(text)) criteria.crimeCategories.push('FINANCIAL_FRAUD');
    if (/\b(?:vehicle\s+theft|carjack|car\s+theft|auto\s+theft|hijack)\b/i.test(text)) criteria.crimeCategories.push('VEHICLE_THEFT');
    if (/\b(?:kidnapping|abduction|hostage|ransom)\b/i.test(text)) criteria.crimeCategories.push('KIDNAPPING');

    // 3. Detect Property Keywords & Targeted Items (word boundary aware)
    const propertyCatalog = [
      { name: 'graphics cards', aliases: ['graphics card', 'graphics cards', 'gpu', 'gpus', 'rtx', 'video card', 'video cards'] },
      { name: 'cash', aliases: ['cash', 'currency', 'money', 'notes', 'inr', 'usd', 'dollars', 'safe', 'till', 'register'] },
      { name: 'electronics', aliases: ['electronics', 'electronic components', 'pos terminals', 'point of sale', 'laptops', 'computers', 'tablets', 'smartphones', 'iphones'] },
      { name: 'jewelry', aliases: ['jewelry', 'jewellery', 'gold', 'diamonds', 'watches', 'luxury watches', 'silver'] },
      { name: 'firearms', aliases: ['firearms', 'guns', 'pistol', 'handgun', 'weapon', 'rifles'] },
      { name: 'vehicles', aliases: ['vehicle', 'car', 'truck', 'motorcycle', 'fluchtfahrzeug'] },
      { name: 'digital assets', aliases: ['digital funds', 'bank funds', 'cryptocurrency', 'neft', 'wire transfer', 'credentials'] }
    ];

    for (const item of propertyCatalog) {
      for (const alias of item.aliases) {
        const regex = new RegExp(`\\b${alias}\\b`, 'i');
        if (regex.test(text)) {
          if (!criteria.propertyKeywords.includes(item.name)) {
            criteria.propertyKeywords.push(item.name);
          }
          if (!criteria.stolenProperty.includes(alias)) {
            criteria.stolenProperty.push(alias);
          }
          break;
        }
      }
    }

    // 4. Detect "Ignored / Left Behind" items (e.g., "ignored cash", "left cash behind")
    const ignoredMatches = text.match(/(?:ignored|left\s+behind|neglected|bypassed|did\s+not\s+take)\s+([a-z\s]+?)(?:and|stole|but|\.|$)/i);
    if (ignoredMatches) {
      const ignoredPhrase = ignoredMatches[1].trim();
      for (const item of propertyCatalog) {
        if (item.aliases.some(a => ignoredPhrase.includes(a))) {
          criteria.ignoredItems.push(item.name);
        }
      }
    }

    // 5. Detect Approximate Time & Time of Day Window
    const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(pm|am|hours|o'?clock)?/i);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1], 10);
      const isPm = /pm/i.test(timeMatch[3] || '');
      const isAm = /am/i.test(timeMatch[3] || '');

      if (isPm && hour < 12) hour += 12;
      else if (isAm && hour === 12) hour = 0;

      if (hour >= 0 && hour <= 23) {
        criteria.approximateTime = {
          raw: timeMatch[0].trim(),
          hour24: hour,
          window: [(hour - 2 + 24) % 24, (hour + 2) % 24]
        };
      }
    } else if (text.includes('night') || text.includes('late evening')) {
      criteria.approximateTime = { raw: 'night', hour24: 21, window: [19, 23] };
    } else if (text.includes('afternoon')) {
      criteria.approximateTime = { raw: 'afternoon', hour24: 14, window: [12, 17] };
    } else if (text.includes('morning')) {
      criteria.approximateTime = { raw: 'morning', hour24: 9, window: [7, 11] };
    }

    // 6. Detect Premises / Facility Characteristics
    if (/\b(?:commercial|warehouse|distribution\s+center|depot|logistics)\b/i.test(text)) criteria.premises = 'COMMERCIAL_WAREHOUSE';
    else if (/\b(?:retail|store|shop|mall|showroom|supermarket)\b/i.test(text)) criteria.premises = 'RETAIL_STORE';
    else if (/\b(?:residence|residential|house|home|apartment|flat)\b/i.test(text)) criteria.premises = 'RESIDENTIAL';
    else if (/\b(?:bank|atm|vault|financial\s+institution)\b/i.test(text)) criteria.premises = 'FINANCIAL_INSTITUTION';
    else if (/\b(?:street|alley|highway|road|parking\s+lot)\b/i.test(text)) criteria.premises = 'PUBLIC_STREET';

    // 7. Detect Target Country Filters
    if (/\b(?:india|delhi|mumbai|bengaluru|kolkata|indian)\b/i.test(text)) criteria.targetCountries.push('India');
    if (/\b(?:uk|united\s+kingdom|britain|england|london|british)\b/i.test(text)) criteria.targetCountries.push('United Kingdom');
    if (/\b(?:us|usa|united\s+states|chicago|illinois|america|american)\b/i.test(text)) criteria.targetCountries.push('United States');
    if (/\b(?:canada|toronto|canadian)\b/i.test(text)) criteria.targetCountries.push('Canada');
    if (/\b(?:australia|sydney|nsw|australian)\b/i.test(text)) criteria.targetCountries.push('Australia');

    return criteria;
  }
}

module.exports = QueryParser;
