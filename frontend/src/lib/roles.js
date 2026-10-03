export function roleOf(user, t) {
  if (!user) return null;
  if (user.is_admin) return { key: 'admin', name: t('roles.admin'), icon: 'shield_person', gradient: 'from-tertiary to-primary-container' };
  if (user.category) {
    const slug = user.category.slug;
    const known = t(`roles.${slug}.name`) !== `roles.${slug}.name`;
    return {
      key: slug,
      name: known ? t(`roles.${slug}.name`) : user.category.name,
      cabinet: known ? t(`roles.${slug}.cabinet`) : t('dashboard.title'),
      clients: known ? t(`roles.${slug}.clients`) : t('dashboard.statToday'),
      icon: user.category.icon,
      gradient: user.category.gradient,
    };
  }
  return { key: 'customer', name: t('roles.customer'), icon: 'person', gradient: 'from-primary-container to-secondary-container' };
}
