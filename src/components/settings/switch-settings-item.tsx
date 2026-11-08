'use client';

import { Switch } from '@karasu-lab/ui';
import { SettingsItemContainer, type SettingsItemContainerProps } from './settings-item-container';

export interface SwitchSettingsItemProps {
  title: SettingsItemContainerProps['title'];
  description?: SettingsItemContainerProps['description'];
  autoFitText?: SettingsItemContainerProps['autoFitText'];
  icon?: SettingsItemContainerProps['icon'];
  iconImageSrc?: SettingsItemContainerProps['iconImageSrc'];
  iconNode?: SettingsItemContainerProps['iconNode'];
  iconBackgroundColor?: SettingsItemContainerProps['iconBackgroundColor'];
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  hasItemAbove?: boolean;
  hasItemBelow?: boolean;
}

export function SwitchSettingsItem({
  title,
  description,
  autoFitText,
  icon,
  iconImageSrc,
  iconNode,
  iconBackgroundColor,
  checked,
  onCheckedChange,
  disabled = false,
  hasItemAbove,
  hasItemBelow,
}: SwitchSettingsItemProps) {
  const interactive = onCheckedChange !== undefined;

  return (
    <SettingsItemContainer
      title={title}
      description={description}
      autoFitText={autoFitText}
      icon={icon}
      iconImageSrc={iconImageSrc}
      iconNode={iconNode}
      iconBackgroundColor={iconBackgroundColor}
      onClick={interactive && !disabled ? () => onCheckedChange(!checked) : undefined}
      trailing={
        <Switch
          checked={checked}
          disabled={disabled || !interactive}
          onCheckedChange={interactive ? onCheckedChange : undefined}
          aria-label={title}
        />
      }
      hasItemAbove={hasItemAbove}
      hasItemBelow={hasItemBelow}
    />
  );
}
