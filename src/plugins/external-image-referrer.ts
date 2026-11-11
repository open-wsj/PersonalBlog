import { defineHastPlugin } from "satteri";

/**
 * 外站图片（如从 CSDN 迁入的文章）带防盗链，浏览器默认的 Referer 会让 CDN 返回 403。
 * 统一给外链 img 补 `referrerpolicy="no-referrer"`，站内图片不受影响。
 */
export const externalImageReferrer = defineHastPlugin({
    name: "stalux-external-image-referrer",
    element: {
        filter: ["img"],
        visit(node, ctx) {
            const src = node.properties?.src;
            if (typeof src !== "string" || !/^https?:\/\//iu.test(src)) return;
            if (node.properties?.referrerPolicy !== undefined) return;
            ctx.setProperty(node, "referrerPolicy", "no-referrer");
        },
    },
});
