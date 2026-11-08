'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight, LoaderCircle, Settings, type LucideIcon } from 'lucide-react';
import { Checkbox, RadioGroupItem } from '@karasu-lab/ui';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/use-is-mobile';

const DEFAULT_ICON_BACKGROUND_COLOR = '#8e8e93';

export interface SettingsItemNestedItemData {
  key: string;
  title: string;
  description?: string;
  icon?: LucideIcon | null;
  iconBackgroundColor?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  radioValue?: string;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  trailing?: React.ReactNode;
  content?: React.ReactNode;
}

export interface SettingsItemContainerProps {
  title: string;
  description?: string;
  autoFitText?: boolean;
  icon?: LucideIcon | null;
  iconImageSrc?: string;
  iconNode?: React.ReactNode;
  iconBadge?: React.ReactNode;
  iconBackgroundColor?: string;
  arrowIcon?: LucideIcon;
  href?: string;
  onClick?: () => void | Promise<void>;
  trailing?: React.ReactNode;
  items?: SettingsItemNestedItemData[];
  children?: React.ReactNode;
  disabled?: boolean;
  hasItemAbove?: boolean;
  hasItemBelow?: boolean;
  className?: string;
}

const MIN_FONT_SIZE_PX = 10;

function FittingText({ text, autoFit, className }: { text: string; autoFit: boolean; className?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || !autoFit) return;
    const fit = () => {
      el.style.fontSize = '';
      let size = Number.parseFloat(window.getComputedStyle(el).fontSize);
      while (el.scrollWidth > el.clientWidth && size > MIN_FONT_SIZE_PX) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (el.parentElement) observer.observe(el.parentElement);
    return () => observer.disconnect();
  }, [autoFit, text]);

  return (
    <span ref={ref} className={cn('block', autoFit ? 'whitespace-nowrap' : 'break-words', className)}>
      {text}
    </span>
  );
}

export interface SettingsItemIconButtonProps {
  label: string;
  icon: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export function SettingsItemIconButton({ label, icon: Icon, loading = false, disabled = false, onClick, className }: SettingsItemIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(
        'flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50',
        className
      )}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" /> : <Icon className="size-4" />}
    </button>
  );
}

export function SettingsItemContainer({
  title,
  description,
  autoFitText = false,
  icon,
  iconImageSrc,
  iconNode,
  iconBadge,
  iconBackgroundColor = DEFAULT_ICON_BACKGROUND_COLOR,
  arrowIcon: ArrowIcon = ChevronRight,
  href,
  onClick,
  trailing,
  items,
  children,
  disabled = false,
  hasItemAbove = false,
  hasItemBelow = false,
  className,
}: SettingsItemContainerProps) {
  const Icon = icon === undefined ? Settings : icon;
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = React.useState(false);
  const hasItems = items !== undefined && items.length > 0;
  const collapsible = hasItems && isMobile && href === undefined;
  const itemsVisible = hasItems && (!collapsible || expanded);
  const isInteractive = (href !== undefined || onClick !== undefined || collapsible) && !disabled;
  const pathname = usePathname();
  const [activating, setActivating] = React.useState(false);

  React.useEffect(() => {
    setActivating(false);
  }, [pathname]);

  function handleLinkClick(e: React.MouseEvent) {
    if (activating) {
      e.preventDefault();
      return;
    }
    setActivating(true);
  }

  async function handleButtonClick() {
    if (activating) return;
    setActivating(true);
    try {
      await onClick?.();
    } finally {
      setActivating(false);
    }
  }

  function handleOverlayClick() {
    if (collapsible) {
      setExpanded((prev) => !prev);
      return;
    }
    void handleButtonClick();
  }

  const overlayClassName = cn(
    'absolute inset-0 rounded-[inherit] transition-colors',
    'hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
    activating && 'pointer-events-none'
  );

  return (
    <div
      data-slot="settings-item-container"
      aria-disabled={disabled || undefined}
      className={cn(
        'relative flex flex-col border border-border bg-card px-4 py-3 text-card-foreground',
        'rounded-xl',
        hasItemAbove && 'rounded-t-none border-t-0',
        hasItemBelow && 'rounded-b-none border-b-0',
        disabled && 'opacity-50',
        className
      )}
    >
      {isInteractive && href !== undefined ? (
        href.startsWith('http://') || href.startsWith('https://') ? (
          <a href={href} aria-label={title} aria-disabled={activating || undefined} onClick={handleLinkClick} className={overlayClassName} />
        ) : (
          <Link href={href} aria-label={title} aria-disabled={activating || undefined} onClick={handleLinkClick} className={overlayClassName} />
        )
      ) : isInteractive && (onClick !== undefined || collapsible) ? (
        <button
          type="button"
          aria-label={title}
          aria-expanded={collapsible ? expanded : undefined}
          disabled={activating}
          onClick={handleOverlayClick}
          className={cn(overlayClassName, 'cursor-pointer')}
        />
      ) : null}

      <div className={cn('flex gap-3', children !== undefined ? 'items-start' : 'items-center')}>
        {(Icon !== null || iconImageSrc !== undefined || iconNode !== undefined) && (
          <span aria-hidden="true" className="pointer-events-none relative shrink-0">
            <span
              className="flex size-8 items-center justify-center overflow-hidden rounded-md"
              style={{ backgroundColor: iconBackgroundColor }}
            >
              {iconImageSrc ? (
                <img src={iconImageSrc} alt="" className="size-full object-cover" />
              ) : iconNode !== undefined ? (
                <span className="flex items-center justify-center text-white">{iconNode}</span>
              ) : Icon !== null ? (
                <Icon className="size-4.5 text-white" />
              ) : null}
            </span>
            {iconBadge !== undefined && (
              <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-background shadow ring-1 ring-border">
                {iconBadge}
              </span>
            )}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="pointer-events-none block">
            <FittingText text={title} autoFit={autoFitText} className="text-sm font-medium" />
            {description !== undefined && (
              <FittingText text={description} autoFit={autoFitText} className="text-sm text-muted-foreground" />
            )}
          </span>
          {children !== undefined && <span className="relative z-10 mt-1 block">{children}</span>}
        </span>

        {trailing !== undefined ? (
          <span className="relative z-10 shrink-0">{trailing}</span>
        ) : collapsible ? (
          expanded ? (
            <ChevronDown aria-hidden="true" className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ArrowIcon aria-hidden="true" className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
          )
        ) : isInteractive ? (
          <ArrowIcon aria-hidden="true" className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
        ) : null}
      </div>

      {itemsVisible && (
        <span className="relative z-10 mt-1 ml-11 block">
          {items?.map((item) =>
            item.checked !== undefined ? (
              <CheckSettingsItem
                key={item.key}
                title={item.title}
                description={item.description}
                icon={item.icon ?? null}
                iconBackgroundColor={item.iconBackgroundColor}
                checked={item.checked}
                onCheckedChange={item.onCheckedChange}
                disabled={item.disabled}
                className="border-0 bg-transparent px-0"
              />
            ) : item.radioValue !== undefined ? (
              <SettingsItemContainer
                key={item.key}
                title={item.title}
                description={item.description}
                icon={item.icon ?? null}
                iconBackgroundColor={item.iconBackgroundColor}
                disabled={item.disabled}
                onClick={item.onClick}
                trailing={<RadioGroupItem value={item.radioValue} disabled={item.disabled} aria-label={item.title} />}
                className="border-0 bg-transparent px-0"
              />
            ) : (
              <SettingsItemContainer
                key={item.key}
                title={item.title}
                description={item.description}
                icon={item.icon ?? null}
                iconBackgroundColor={item.iconBackgroundColor}
                disabled={item.disabled}
                onClick={item.onClick}
                trailing={item.trailing}
                className="border-0 bg-transparent px-0"
              >
                {item.content}
              </SettingsItemContainer>
            )
          )}
        </span>
      )}
    </div>
  );
}

export interface CheckSettingsItemProps {
  title: string;
  description?: string;
  icon?: LucideIcon | null;
  iconBackgroundColor?: string;
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  hasItemAbove?: boolean;
  hasItemBelow?: boolean;
  className?: string;
}

export function CheckSettingsItem({
  title,
  description,
  icon,
  iconBackgroundColor,
  checked,
  onCheckedChange,
  disabled = false,
  hasItemAbove,
  hasItemBelow,
  className,
}: CheckSettingsItemProps) {
  const interactive = onCheckedChange !== undefined;

  return (
    <SettingsItemContainer
      title={title}
      description={description}
      icon={icon}
      iconBackgroundColor={iconBackgroundColor}
      onClick={interactive && !disabled ? () => onCheckedChange(!checked) : undefined}
      trailing={
        <Checkbox
          checked={checked}
          disabled={disabled || !interactive}
          onCheckedChange={interactive ? onCheckedChange : undefined}
          aria-label={title}
        />
      }
      hasItemAbove={hasItemAbove}
      hasItemBelow={hasItemBelow}
      className={className}
    />
  );
}

export interface SettingsItemGroupProps {
  children: React.ReactNode;
  className?: string;
}

export function SettingsItemGroup({ children, className }: SettingsItemGroupProps) {
  const items = React.Children.toArray(children);
  return (
    <div className={cn('flex flex-col divide-y divide-transparent', className)}>
      {items.map((child, index) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child as React.ReactElement<SettingsItemContainerProps>, {
          key: child.key ?? index,
          hasItemAbove: index > 0,
          hasItemBelow: index < items.length - 1,
        });
      })}
    </div>
  );
}
