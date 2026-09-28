import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/format";
import { cn } from "cn";

const SIZE_CLASSES = {
  sm: "size-8 text-[0.6875rem]",
  md: "size-9 text-xs",
  lg: "size-14 text-base",
} as const;

const FALLBACK_TEXT_CLASSES = {
  sm: "text-[0.625rem]",
  md: "text-[0.6875rem]",
  lg: "text-base",
} as const;

export interface UserAvatarProps {
  name?: string;
  imageUrl?: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}


export function UserAvatar({
  name = "User",
  imageUrl,
  size = "md",
  className,
}: UserAvatarProps) {
  return (
    <Avatar
      className={cn("bg-brand text-white", SIZE_CLASSES[size], className)}
    >
      {imageUrl ? (
        <AvatarImage src={imageUrl} alt={`${name} profile`} />
      ) : null}

      <AvatarFallback
        className={cn(
          "rounded-full bg-brand font-semibold text-white",
          FALLBACK_TEXT_CLASSES[size],
        )}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
