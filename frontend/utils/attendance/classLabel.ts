/** How a class is named on screen: "Mathematics · Class 6 A", or "Class 6 A" for a whole-section class. */
export const classLabel = (item: { section: { name: string; class_name: string }; subject?: { name: string } | null }): string => {
  const section = `${item.section.class_name} ${item.section.name}`.trim();
  return item.subject ? `${item.subject.name} · ${section}` : section;
};
