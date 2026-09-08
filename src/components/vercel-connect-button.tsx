import { SiVercel } from 'react-icons/si';
import { buttonVariants, Tooltip, TooltipContent, TooltipTrigger } from '@Hashibutogarasu/ui';
import { CheckCircle2 } from 'lucide-react';

interface VercelConnectButtonProps {
  connected: boolean;
  connectLabel: string;
  connectedLabel: string;
}

/** Header icon button for the Vercel OAuth connection: a link to start the OAuth flow when disconnected, or a link to disconnect when already connected. */
export function VercelConnectButton({ connected, connectLabel, connectedLabel }: VercelConnectButtonProps) {
  if (connected) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <a href="/api/vercel/disconnect" aria-label={connectedLabel} className={buttonVariants({ variant: 'ghost', size: 'icon' }) + ' relative'}>
              <SiVercel className="size-4" />
              <CheckCircle2 className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-background text-green-500" />
            </a>
          }
        />
        <TooltipContent>{connectedLabel}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a href="/api/vercel/authorize" aria-label={connectLabel} className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
            <SiVercel className="size-4" />
          </a>
        }
      />
      <TooltipContent>{connectLabel}</TooltipContent>
    </Tooltip>
  );
}
