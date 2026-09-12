/** Reading preference from the supplied lineage notes and existing biographies.
 * Only applied to existing edges; this does not create or certify a relationship.
 * No inferred seniority from age, popularity, ID order, or number of descendants.
 * Shi Fukuan follows the notes' usual designation of Yu Qian; the earlier
 * “马蹄” account remains in his biography rather than being silently removed.
 */
export const firstDisciple: Readonly<Record<string, string>> = {
  'a-yantao': 'en-xu',
  'en-xu': 'li-dexi',
  'jiao-dehai': 'zhang-shouchen',
  'zhang-shouchen': 'chang-baokun',
  'chang-baokun': 'li-boren',
  'ma-delu': 'gao-guiqing',
  'ma-sanli': 'yan-xiaoru',
  'shi-fuquan': 'yu-qian',
  'yu-qian': 'feng-zhaoyang',
};
