import { FiGithub } from 'react-icons/fi';

export function GithubCorner() {
  return (
    <a
      href="https://github.com/Karasu-Lab/karasu-lab-admin"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="View on GitHub"
      className="fixed bottom-0 right-0 z-50 group"
    >
      <div className="relative w-20 h-20">
        <div
          className="absolute inset-0 bg-foreground transition-opacity group-hover:opacity-75"
          style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
        />
        <FiGithub className="absolute bottom-3 right-3 size-5 text-background" />
      </div>
    </a>
  );
}
