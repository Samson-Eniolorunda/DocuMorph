/** The line under every upload area: what happens to the file. */
export function UploadNote({ where }: { where: "device" | "server" }) {
  return (
    <p className="mt-2 text-body-sm text-subtle">
      {where === "server"
        ? "Files are processed for this conversion only and deleted straight after."
        : "Files are processed on your device for this task only and are not uploaded."}
    </p>
  );
}
