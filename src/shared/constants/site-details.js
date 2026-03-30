// We found a valid real-life 23-site Shapefile that had 4MB of site data in the exemption (mostly geoJSON).10MB
// was chosen as a reasonable limit to accommodate this file, with a decent overhead for contingency while not
// overloading the server.
export const tenMegaBytes = 10 * 1000 * 1000
