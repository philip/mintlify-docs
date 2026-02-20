#!/usr/bin/perl
use strict;
use warnings;

undef $/;
my $content = <>;
# Strip frontmatter
$content =~ s/^---\r?\n.*?\r?\n---\r?\n?//s;
# Replace Admonition blocks
$content =~ s/<Admonition\s+type="(note|tip|warning|info|important|comingSoon)"(?:\s+title="([^"]*)")?\s*>(.*?)<\/Admonition>/replace_admonition($1,$2,$3)/gse;

sub replace_admonition {
  my ($type, $title, $body) = @_;
  $type = "Warning" if $type eq "important";
  $type = "Info" if $type eq "comingSoon";
  $type = ucfirst(lc($type));
  my $open = $title ? "<$type title=\"$title\">" : "<$type>";
  return $open . $body . "</$type>";
}
print $content;
