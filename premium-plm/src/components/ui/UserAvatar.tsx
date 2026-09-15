interface  UserAvatarProps {
    name?: string;
    imageUrl?: string;
    size?: "sm" | "md" | "lg";
}


function UserAvatar({
    name = "User",
    imageUrl,
    size = "md",
}: UserAvatarProps) {
    const initials = name
        .trim()
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0].toUpperCase())
        .join("");

    return (
        <div className={`user-avatar user-avatar-${size}`}>
            {imageUrl ? (
                <img src={imageUrl} alt={`${name} profile`}/>
            ) : (
                <span>{initials || "U"}</span>
            )
        }
        </div>
    )
}

export default UserAvatar