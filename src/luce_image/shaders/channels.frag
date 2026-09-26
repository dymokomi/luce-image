// The Channels panel's view of a tile: its red, green and blue kept or
// hidden, or one channel alone as grayscale. Image 1 is a straight-alpha
// tile (the composite at the view's level, or a coarser one standing in, or
// an alpha channel's selection tile); `region` is the texels of it drawn into
// the destination whose top-left lands at `origin`. The result is
// premultiplied, for Blend.over.
//   gray 0: each channel times `keep` (1 shown, 0 hidden), in color
//   gray 1: dot(color, keep) as gray: one channel alone, keep picking it
//   gray 2: the same, opaque: an alpha channel (coverage in red) seen alone
//   gray 3: an alpha channel over the picture: `keep`'s color at its w
//           opacity where the channel (coverage in red) selects nothing
#version 450
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params {
    vec2 origin;      // where the region's top-left lands on screen, in target pixels
    vec2 scale;       // texels per target pixel, across and down
    vec2 corner;      // the region's first texel in the tile
    vec2 size;        // the region's texels
    vec4 keep;        // red, green, blue shown (1) or hidden (0); a matte's color and opacity
    float gray;       // 0 color, 1 grayscale, 2 opaque grayscale, 3 matte
    float unused1;
    float unused2;
    float unused3;
} params;
layout(set = 0, binding = 1) uniform sampler2D image;
void main() {
    vec2 p = (gl_FragCoord.xy - params.origin) * params.scale;
    if (p.x < 0.0 || p.y < 0.0 || p.x >= params.size.x || p.y >= params.size.y) { fragment_color = vec4(0.0); return; }
    // Held inside the region: a filtered sample at its edge reads nothing past it.
    vec4 c = texture(image, (params.corner + clamp(p, vec2(0.5), params.size - 0.5)) / 256.0);
    if (params.gray > 2.5) {
        float covered = (1.0 - clamp(c.r, 0.0, 1.0)) * params.keep.a;
        fragment_color = vec4(params.keep.rgb * covered, covered);
        return;
    }
    float alpha = params.gray > 1.5 ? 1.0 : clamp(c.a, 0.0, 1.0);
    vec3 shown = params.gray > 0.5 ? vec3(dot(c.rgb, params.keep.rgb)) : c.rgb * params.keep.rgb;
    fragment_color = vec4(clamp(shown, 0.0, 1.0) * alpha, alpha);
}
