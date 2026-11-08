import { Blobatar } from "@blobatar/react";

interface UserAvatarProps {
    name?: string;
    imageUrl?: string;
    size?: "sm" | "md" | "lg";
    // "hover" wakes the character when the pointer is over it; "always"
    // keeps it gently alive (the profile page).
    animate?: "hover" | "always";
}

const PIXELS = { sm: 32, md: 40, lg: 56 } as const;

// A person's avatar: their photo when there is one, otherwise their own
// Blobatar, a small character drawn from their name, so each person always
// gets the same one and no two people look alike. Its motion styles come
// from blobatar/motion.css, imported once in main.tsx.
function UserAvatar({ name = "User", imageUrl, size = "md", animate = "hover" }: UserAvatarProps) {
    return (
        <div className={`user-avatar user-avatar-${size}`}>
            {imageUrl ? (
                <img src={imageUrl} alt={`${name} profile`} />
            ) : (
                <Blobatar name={name.trim().toLowerCase() || "user"} size={PIXELS[size]} background="circle" animate={animate} title={name} />
            )}
        </div>
    );
}

export default UserAvatar;
