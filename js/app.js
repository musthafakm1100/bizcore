let salesOrders = [];
let editingSOId = null; // current SO being worked on in modals
let currentSOId = null; // SO open in view modal
const VAT_RATE_DEFAULT = 0.15;
let quotations = [];
let customers = [];
let suppliers = [];
let products = [];
let rfqs = [];
let employees = [];
let employeePhotoDraft = '';
let editingEmployeeId = null;
const DEFAULT_LOGO_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABUEAAAEyCAYAAADUYRHcAAAACXBIWXMAAD2DAAA9gwGH6AkLAAAgAElEQVR4nO3dT1IbWdov4OwbNVQY7wB/E0/xXQHUCuyO0MwDXNpA0SswXkFTG1DBwDNFNF5BwQo+PPWkYQUXHJr7xuk6dGELY0ko8/x7nghHR6VoW/mH1Ktfvuecv3358qUDAAAAAKjV/3FmAQAAAICaCUEBAAAAgKoJQQEAAACAqglBAQAAAICqCUEBAAAAgKoJQQEAAACAqglBAQAAAICqCUEBAAAAgKoJQQEAAACAqglBAQAAAICqCUEBAAAAgKoJQQEAAACAqglBAQAAAICq/ZTzzo3G0zdd1z1beIF1XHddd3Hn/3cxn02uHcnNGY2nL7que3rnL9wrfZ/uuIx/bjVx/WR0DzqezyaXC1t7NBpPD4feyXtczmeT48XN/Wn5nN8ajadh/98svJCH0/lscpHpe7tXLtfUfDYZ9Hd6NJ7uVfY52LLB78VDqrx+a7L+V78lp37bgIyzkOI+EzKqbTd2fXx+/fzFk/efiqqJc5F1CBov1N2FrWzEaDwNf83HGG6dxcLozNF92Gg8fRoL5Bfxf8NNdfvB/1OF7lw/F7d/Krx+crkHnX0TQg/hbZpd/cp5KBYWtvar5XN+61km5/8+4b776p7tOcvlmhr6i/FextcRq0lxL9449dufGqn/1W9pqd82I9ssZDSenqV6WL+mXGrbTV4fR59fP3/z5P2nks5DFnIPQenfTvzzsvvzhnYTfzlPY8eNbtG/ugTexKJ5Z+EH2nV7/ex3rh+gfy/D0/zCCm8gEfXbd31b/4f/+aB+A5b0JsHDVRYdG3WzOnOC8q2tWBD93nXd/xuNp8exgGxSGIYwGk9Dl+P/dl33qwL6h+67ftyYgU3Kdag+kAn121rUb8Cy1GJ52A3doK0fhFUJQfmR0OH3v6HlvaViKMynMxpPr2MxqHBeX7h+/mjt+gF6deDwAvdRv22M+g14yHacs5T0wrD4p87D8oSgLGs3FkPHcU6lKo3G01ej8fQyzhmy5erYmNvr5zROTA2wri2FN3BXCOrUb71QvwHfoxbLw5apCVYjBGVV4cnwZQgLazpyIdgNBV7Xdf9qcZL8AYWhVhcCDOCRdIMCd+u3P9Rvvbqt39x7gVu7Ho5k49ewWnzrB2FZQlDWEZ42/Ct0hdZw9OKcpxe3k8PTu3D9/F57VzHQq52W56sG1G8JhPrtn+o34A4diPk4av0ALEsIymPsh0nnSy6EYkfrme6BJEJX8ZlCGliTjiRolPotKfUbcOuVe0E2wiJJauMlCEF5rJ1SC6E4JPtf5o5KqtjrB0hu370D2qN+y4L6Dejifdg0Z/k4tEjSjwlB2YTiCqHYQfD7wgukoJAG1qXwhobElcrVb3lQvwGdkTlZ2TIs/seEoGxKKISKmCM0ziFVxXymFdmJw9oAVqHwhkbE+u3U+c6KIBTYjg+oyMP+59fPnY8HCEHZpJej8TTryZFjkXZqCFWWwkInnlwBq9iOnf1AxWL9dqx+y9KOziNonofSeXFPfoAQlE17m/mKvYcm0c/arwINYEUKb6jfYQzbyNO++g2aFpqhnrV+EDKyY5Gk7xOC0ocsh5rHNv1fF14gN0eGVQEr2FV4Q73Ub8U4Vr9B04RueQmLJKmP7yEEpQ87ceXO3GgLL8O2D1FgRe4ZUK+sp1riv7bci6FpFqvMi0WSvkMISl+yKlhjKGsYVTkOdBMAK3jjngH1ifXbrlNbjLc686FZW5k2QrXspUWSFglB6ct2ZjdBXQRl0U0ArCLcM8xHB/VRC5THOYN2+f3PT5ZTFaYkBKVPWdwE41xSFkMqjw9RYBUedkFF4kKbRvGURycYtGsn80WSW7T9+fVzNfIdQlD6lMtNUDFWJkMqgFVsx4deQB08DC2T+g3a5t6dnwOLJP1FCErfciiCDJEsl3MHrMIXb6iHGqBczh20a9887dnZMiz+L0JQ+pa0Kyd2BW0tvEApdHUBq9i3KAeUL44kUr+V62XrBwAapxs0P7ufXz9v/gFVJwRlADuJnwQJ0cq2ZXgrsCLdoFA+X9QKp36DpqnF8nT0+fXz5rt0haAMIWURpAArn3MIrELhDeXz2V8+5xDaFeZp9zArP2Gx6Oa7dIWgDCHl4khWpyufcwisYtuiHFA8n/3lcw6hbc2HbZl62/oiSUJQhpCkCIrD8M0nVT7z+wGrEoJC2dRv5ROCQtt2zdOeraYXSRKCMoRU804ovuqw0/oBAFa2GxdWAQpjLslqbLd+AADdoJkKiyQ12zAgBGUIqb6INj/pL0DDFN4ACSVeHBVI7437QLaaXSRJCMoQUg1p0gVUCV0hwBpeKbyhSOq3ejiX0LaQA1ggKU/h3By2uONCUACgRlvmBoUieXgBUI8mg7ZC/Pr59fPmHlYJQQGAWhkSDwCQzrZRfVk7am2HhaAAQK0U3gAAaRmZk6+wSFJTTQM/LWzhPj/PZ5Oze7ZnbzSehvbzt85qUq4fgHRCYVfkPbhk89nkMPchcKPx9MvCxuGdz2cTQX2e1G8Am7Ef7kvz2eTS8czS4efXz4+fvP903cLO6gQFAGr2cjSePnOGAQCS0Q2ar62WhsULQQGA2pkbFAAgHbVY3vY/v37exMgUISgAUDvdBwAA6WyNxlP1WN6a6AYVggIAtVN4AwCkpRbL287n18+zns99E4SgAEALDMMCAEhndzSevnD8s3bw+fXzqufSF4ICAC3YUXgDACTloXTeql8kSQgKALRC4Q0AkM6r0Xj61PHP2suaF0kSggIArdhXeAMAJLNlbtAiHNe6Y0JQAKAlukEBANJRi+Vvu9ZFkoSgAEBLdB8AAKSzPRpPXzn+2Xtb4yJJQlAAoCUKbwCAtDyULkN1w+KFoABAawzDAgBI5+VoPK2uy7BCu59fP6+qeUAICgC0ZlfhDQCQlIfSZTj6/Pp5NQuLCkEBgBZVOdk7AEAhDIkvw3ZNgbUQFABo0avReFrNU20AgMJsjcZTQWgZwiJJL2rYESEoANCirRCEOvMAAMkYEl+Ooxp2QggKALTKkHgAgHR2RuPpnuNfhLBIUvGdu0JQAKBV2wpvAICkDIkvR/GLJAlBAYCWKbwBANLZN097MbZKH0klBAUAWhYK72euAACAZMwNWo5fS14kSQgKALRONygAQDpqsbIcl/rGhaAAQOt0HwAApBPmaX/l+Bdj5/Pr50XWz0JQAKB1W6PxVAcCAEA6HkqX5bDERZKEoAAAhmEBAKS0a572ooRFko5Ke9NCUACAPwvvYid5BwCoQNErjzdo//Pr53sl7bYQFADgT4ZhAQCk82o0nhY3xLpxRXWDCkEBAP6k8AYASCcMsbZAUlnCIknFdPAKQQEA/rRlblAAgKQMiS/PwefXz4uYz1UICgDwF0PiAQDS2R6Np0XNM0k5iyQJQQEA/hIKb8OwAADS8VC6PC9LWCRJCAoA8DVD4gEA0nk5Gk+LGF7NV45zPxxCUACArym8AQDS8lC6PNu5L5IkBAUAWGQYFgBAOmqxMr3NeZEkISgAwKI3o/H06cJWAACGsDUaT3WDlinbYfFCUAAgR+dd110lfF9hlUsLJAEALTtPvO9C0DLtfn79PMs6WggKAOQq9VNkw7AAgJalrsV2R+Ppi4WtlODo8+vn2Y2qEoICALk6Svy+dkbj6d7CVgCANlx2XXeSeE89lC7Tdo7nTggKAGRpPptcZ1B4G4YFALQsdTfovnnaixUWScqqk1cICgDkLHU3qMIbAGjWfDY567ruY+L991C6XKlr+a8IQQGAbM1nk4sMJuU3DAsAaFnqIEstVq6wSFI2IbYQFADIXephWLoPAIBmzWeTUIvdJNz/7dF4muVq4ywlm0WShKAAQNZi4X2V8D2GwlsQCgC0LHU3qFqsXFtd1x3m8O6FoABACXSDAgCkk7oWezkaT58tbKUUv+awSJIQFAAoQerug12FNwDQqvlsctl13Uni3Tc3aNlSB+lCUAAgf/PZ5DqDwjuLYTwAAIkkH5kzGk+zmFuStex8fv08aZAtBAUASpG6G/SVwhsAaNV8Njnruu5jwt0Pc0taIKlshykXSRKCAgBFmM8mF13XnSd8rwpvAKB1qR9KGxJftq2U15AQFAAoSephWIbEAwDNms8moRa7Sbj/O6PxdG9hKyXZ//z6eZJzKAQFAIoRC++rhO93W+ENADQudTfom4UtlCbJNSQEBQBKk7ob1DAsAKBlqWux/dF4+mxhKyUJiyQNPsJKCAoAlCZ198FLhTcA0Kr5bHLZdd1J4t3XDVq+g8+vnw9aUwtBAYCizGeTa4U3AEBSqbtB1WLlG3yRJCEoAFAiK5MCACQyn03Ouq77mPD4h3naBaHleznkIklCUACgOPPZ5KLruvOE73tL4Q0ANM4CSWzC8efXz58OcSSFoABAqSyQBACQyHw2CbXYTcLjv2ue9ipsD1VXC0EBgCLFwvsq4XvfGY2nLxa2AgC0I3U36OArjNOLt0MskiQEBQBKphsUACCd1LXYq9F4OshQanrX+7UkBAUASpa6+2Bf4Q0AtGo+m1x2XXeScPe3zA1ajd3Pr5+/6nNnhKAAQLHms8l14sK7U3gDAI0zModN6fVcCkEBgNKl7gZVeAMAzZrPJmdd131MuP/bo/F0b2ErJep1jlchKABQtPlsctF13XnCfQiFd69DdwAAMuehNI/14cn7T2d9HkUhKABQA8OwAAASmc8moRa7SXj8X47G095XF6c3N0PU00JQAKB4sfC+SrgfuwpvAKBxqbtBzdNerqMn7z9d9v3uhaAAQC10gwIApKMWYx0fn7z/1OtcoLeEoABALZJ3H4zG06cLWwEAGjCfTUIn30nCPd0ajae6QcszWHgtBAUAqjCfTa5TF95d11kgCQBomW5QVnHS92JIdwlBAYCaWJkUACCR+WwSAq2PCY//zmg8fbGwlRwNshjSXUJQAKAa89nkouu684T7EwrvvYWtAADt8FCaZRw+ef/pesgjJQQFAGqTehiWuagAgGbNZ5Pj2OWXyr552rMXFkMaPCwXggIAVYmF91XCfQqF97OFrQAA7dANykOSNA0IQQGAGukGBQBIRy3G9/z25P2ni++81ishKABQo9TdBwpvAKBZ89nkMqz8nXD/t0fj6auFraQWpkk4TPUehKAAQHXms8l1BoW3IBQAaFnqblBD4vNzMPRiSHcJQQGAWukGBQBIZD6bnCWep3236zrztOfj/Mn7T0mDcSEoAFCl+WwS5ho6T7hvCm8AoHXJhj5HukHzkfxcCEEBgJqlHoa1vbAFAKAdp3EeyFR2XGtZeJdqMaS7hKAAQLXms8lx4mFYAADNivO0p34oTVpXGUxT9R9CUACgdgpvAIB0sgjASCbpYkh3CUEBgNopvAEAEpnPJpdd131w/JsUFkM6zWXHhaAAQNXiMKwTZxkAIBkPpdv0Jqe9FoICAC1QeAMAJDKfTc7M096csBjSZU47LQQFAKo3n03CapTnzjQAQDKHDn0zrp68/5Td+RaCAgCtsEASAEA6YW7IG8e/CVkNg78lBAUAmjCfTY4NwwIASCPO0+6hdP0+PHn/6SzHvRSCAgAtUXgDAKRjnva6hU7fg1z3UAgKALRE4Q0AkMh8NgkL5Xxw/Kt1lNtiSHcJQQGAZsRhWCfOOABAMh5K1+ljjosh3SUEBQBaY0g8AEAi89nkzDztVcp2GPwtISgA0JRYeH901gEAksm6Y5CVneS6GNJdQlAAoEWGYQEApHMaF9GhfFkvhnSXEBQAaM58NjlWeAMApBHnaTdFUR0On7z/dF3CnghBAYBW6QYFAEhHLVa+sBhSMedRCAoAtEr3AQBAIvPZ5LLrug+Of9HelPTmhaAAQJNi4X3i7AMAJKMbtFy/PXn/6aKkdy8EBQBaphsUACCR+WwSVhS/cvyLc1PiCv9CUACgWbHw/ugKAABIprgwje6glMWQ7hKCAgCtMwwLACCd09hZSBnOn7z/VORoKiEoANC0+WxyrPAGAEhjPptcm6KoKAelvnEhKACAblAAgJTUYmV4V9piSHcJQQEAdB8AACQzn00uu6774Axk7ar0sFoICgA0LxbeJ60fBwCAhHSD5q3IxZDuEoICAPxJNygAQCLz2eQsdhuSn7AY0mnp50UICgDwV+H90bEAAEjm0KHP0psadkIICgDwF8OwAADSCd2GN45/VsJiSJc17IgQFAAgms8mxwpvAIA05rPJtSmKsnL15P2narpzhaAAAF/TDQoAkI5aLB9VDIO/JQQFAPia7gMAgETms0kYev3B8U/uw5P3n85q2iEhKADAHbHwPnFMAACS0Q2aVpge6qC2nRKCAgAs0g0KAJDIfDYJHYhXjn8yR7UshnSXEBQA4Bux8P648AIAAEOpZkGewnysaTGku4SgAAD3MwwLACCd0zgsm2FVNwz+lhAUAOAe89nkWOENAJDGfDa5NkXR4E5qWwzpLiEoAMD36QYFAEhHLTacKhdDuksICgDwfboPAAASmc8mYXGeD47/IA6fvP90XfMOCkEBAL4jFt4n978KAMAAdIP2LyyGVP1xFoICADxMNygAQCLz2STMUXnl+PfqTcX79l9CUACAB8TC++P3fwIAgJ4dOsC9+e3J+08Xle7bV4SgAAA/ZhgWAEA6p3HhHjbrpqWA+aeFLdznj9F4es9mWIrrh8dq9RraHY2nXxa2QgLz2eR4NJ6GIHTL8YcmqN94LPUbbNB8NrkejadhiqJfHdeNOqh9MaS7dIICACxHNygAQDpqsc06f/L+U1Nz3wtBAb6viXlRgKVZIAkgf2fOEdRpPptcdl33wendmCYWQ7pLCArwfc0MCyA7rr0MxcL7pPXjAD1z/wNK5f41DN2gm/HuyftPlzXsyCqEoAwh1eTFngJXIq7MDC1d87qQ86UbFPrl/lcP55KmqN+GEb8bXrWwrz26ajVMFoIyBB8GlMq1C3wlFt4fHRWAh4VFTB78gf6o36B+zaxm3pOmFkO6SwjKEBRAPEbKsMGQFlI4d9SzZxgW9MToj2qo32iN+m1YpwlHnJYuLIZ02urOC0EZQpIwMj59dmMsX7J5SnwRI5Hm5uYpzXw2Ofb5Ar0yzLF86jdao34bUPyub4qi1d20uBjSXUJQhpCyENENWr7UhaxhrwzNfasMukGhP+6D5Ut9DtVvDM19a3hqsdUdtbgY0l1CUIaQ8gPBk+DypS4oFDQMzX2rDLoPoD/ug+VLfQ5dQwzNNTew+WwSwrwPTe3041w9ef+p+blUhaD07WPCSdG7OFcI5brJYEiTa4gh3VhZtAyx8D5p/ThAT4QJZcuhfnMNMST1Wzq6QZfX9DD4W0JQ+pa0UyZ+GJm3rVw5BJCKaIYkdC+LblDoQazfzAtarhxqJ/UbQ1K/JRIfuPi8+LEPT95/av6+2AlBGUAOHwg+lMqV/NzFTmbDLBiK+1VBYuFt3jnoh/thudRvtMb9Kq3mh3j/QGgKO3j4R9ohBKVP53G4YGpa5Mt0NZ9NcikodHsxhJyueZbnMwb64bO3TGFYcC7nzjXEENRv6Z0a/fmgw9YXQ7pLCEqfsig84pCq84UXyF02hWssbAyzoG/CtALFL/sKb9gw9VuxsvksU78xEGF7YrHz23m438cn7z/5jnGHEJS+XGX0FLjTIl+cmwwDIdcQfbpRvBVNcQn98NlbFvUbrcnxmm+V83A/w+C/IQSlL1kVHHHeNt0E5TiKT/SyEUN93QT0JbtrnpUIsKEH6rfiqN9ojfotE3EaPvMAf+3EYkiLhKD04TyzLtBbngSX4SrjJ3lvFrbA432czybuTwWLhfdJ68cBeqKLpQzqN1pzpX7Ljm7Qv1gM6TuEoGxatr9ssZvgt4UXyM2bXJ+oxmtI0MGm+XJWB92g0IM4N6j6LX+512+uITZN/ZaZ+Luu8/tPYTEkXcr3EIKyaYexWM1VeFr30VnP1rv44ZWzA9cQG/Qu83smS4r3LvcG6MF8NvHZm7ffCqjffAdgk0r4ztIq3bldd24xpO8TgrJJJ/PZJOtftviE+pWVfLN0XsKQkngNvXENsQEnhlFVR8EJ/VG/5ek8htRZU7+xQR/Ub1k79XtuGPxDhKBsSiiAihgSEOdu23NzzMrH+OWmCLFzzzX0MMfmYR8VKPWJ82G79qEH6rcsqd/q49g87KNh8HmLDzxanqLotyfvPxll9gAhKJtQVAHUKYJyE66fvdJWVnQNPegmHptfHvqhhhV5zbM03aDQE5+9WVG/1Uf99jD1WzlarcVuTAfwY0JQHuuk1A8DRVAWzksuJlxD97otEC9iV5xC+msfFNDVs0AS9MhnbxaKDoNcQ/dSvz1M/VaQOHLgQ4O7fmAxpB8TgvIYYULobFeCXEYsgl6YKD2JMIl+8cWEa+grt6H2f4dgxEL6Z180/iPcM18poOsWC++T1o8D9Mlnb1KhfnuhfquK+u1hv6nfitRaN2hYDMmD+CUIQVlH+DD8uZYJoe/MMfXbwov0IVw/fy9hEv1lhWsofCFo/Br6x/dC7bh65otYZLfoqqZ7JktRhELPfPYOTv1Wp3fqt++6/c5rDvcCxev3qqFdNlftkoSgrCoUCc/iTaUa4YM/fsD97Ilwr26vn9Mad67RaygUxv8zn00efNoav2jczjPVUldBuOZf1HbP5GHxfPssgQGo3wZx0kj91lLYd1u/PfiAtvH6rbrvvA168PquyLsn7z9dtn6ylyUEZVkn8YPy4L4nhbUIH3TxifAvjT056lsT10/X1jV0Hp+O78Vu6qXE4VXPwod15cV0M9c83/XggwFgc9Rvvbn9LCt6+qtlxGtoT/12P/UbhTptILy/UnOuRgjKQ27iU7Db4qeZpwvhg34+mzyLhVCrQ0Aeq9nrp/v6Gvp7ZRNzn9wpntd6Oh47rw9jMf2Pir5sNH3N87X4hdFcajAg9dtG3HwTfqrf6vBB/fZd6rdKxSC79imKLIa0op+KercMIXyYhQ/G01qHvKwifok9Ho2n4cP+VfyzW84eDM718414HE7vXEOhy+Dlwg/m7UN8knq6yafi8e8KTy6PRuPpiziXTTg+Ows/nC/XPA8J1/fbB14HeqB+W5nPsm+o375P/UZhwrX6a6UnLSyG5PpdkRC0beGp18XdP3dXBeQv8Yng0W2r+Wg83Ysf9uGD/2mjhfW318+ZJ6ff98A19Cz+yeUaCp0zl7fndai5kOK95z8Tz4/G06d3fr/24u9YDoX11d1j45pnCcdCUEjngc9e9Zv6fynfuYZexD/qN/UbmQvnejSefijwIcaPXN/+7rGav3358iXbQxafLD1deIHHunTj70csjGrn+ulRovvedQlfgGJx/WLhhf41dc0nPM7fKuK6/JFcahmLOyzK5DO7iuu8dOo3Hkv99n3qt/VklIVclD4/auzofrbwwvA2diw/v37+zGJI68k6BAUAAAAAeCwLIwEAAAAAVROCAgAAAABVE4ICAAAAAFUTggIAAAAAVROCAgAAAABVE4ICAAAAAFUTggIAAAAAVROCAgAAAABVE4ICAAAAAFUTggIAAAAAVROCAgAAAABVE4ICAAAAAFUTggIAAAAAVROCAgAAAABVE4ICAAAAAFUTggIAAAAAVROCAgAAAABVE4ICAAAAAFUTggIAAAAAVROCAgAAAABVE4ICAAAAAFUTggIAAAAAVROCAgAAAABVE4ICAAAAAFUTggIAAAAAVfvJ6QUAAHIwGk+fdV33LLOTcT2fTS4Wtn5jNJ7uLWzsz+V8Nrns+x/pYZ8u5rPJ9cLWFQ18rP9jPpucLWxc/X0/7bruxcIL37Hsv7nG8Vjr+lnx/S/1e7PEvxn+vacLLzzORq7DPvS0v8va1Dnr4z7+6HteivvGj2zivsJqhKAAAEAu3nRd9zazs3Hedd0yX57/WNjSo9F4etV1XfgCfbjJQHQ0noZzcNB13c7Ci5v5+z92XXcc/jwiiBr0WHd/vu/wP+G9H3Vdd7rme3+x4nv/28KW+616PK7WDKlWef/L/t4siGFVuA5fdV23tfADGxB/f26vw94fKKwgXF+7if7tEs7ZaThGa56zwe8bS1j2d5wNMRweAACgPNtd1+13Xffv0Xh6FLv01hZCjNF4GoKF3/sKQKPwd/8zdHbFwLUkO/H4XOTYVbaC7RyPfbiGR+PpaQyr9vsK06Lt+MAlnMvDhVdZSoJz9mu85zlnrEUICgAAULYQDJytG4TGQOyPGDIMJYQlv4/G0+MCj3w4Tn8UGOLelVWIFIeBh6HYLxde7Fe4Dt8Weh0mFe83ZwnOWRfP2dr3PNolBAUAACjfThzeu5LY0fh7wr3fH42nBwtby/B7wR2h27kc9xhkHQ8cwn8rXIdHC1t5yFnPXeM/shunD4ClCUEBAADq8HKN7sQcOuAO42IqJSq5g/Awk0663uagXdGvhU9zMJh4n8nhnO07Z6xCCAoAAFCPpbv7YpCRsvvu1tYq7zszWc6vuaRcjntO577kKQ6GlNN0CuYHZWlCUAAAgHrsrNBV+WphSzo5vZdVlfzeD1J2g47G095WE1/TfkbvJUtx/tYcHp7c2jU3KMsSggIAANTlxZJ7k9Mw0u2Cg4xlj3eOUneDZnfsDK/+oRyPT8m/gwxICAoAAFCXZQOBnDrwuoKDjJy64taRshu01LlgW5bjwwrBNUsRggIAAEC7UnaD5hiCCmahUj85sQAAQA7ms8nhqotcjMbT8PNvF16437v4byQ1n03+tuq/v+J+btw67zm+77MwZ9/CC5m/7+7P9/5lYWO9Qjfo0Xw2uc54D3+ezyZnC1uXsOJ1WEoIuvbxGNDa99xN3/PWvO8ufQ94zL2G4egEBQAAgLaVvEI/wFKEoAAAAEDoBjUUHKiWEBQAAADYWnU6CoCSCEEBAACAYF83KFArISgAAABwSzcoUCWrwwMAAAC3Qjfo4Xw2uWzgiNx0XXfRdd1l/HMR/5Cv23N2fQ1AbdIAAAhaSURBVOfc5b5KPpkQggIAAAB3hW7QNxUdkW+Dzuv5bCI4y1s4VyfOGZskBAUAAIA2XHVdt73EnlbVDTqfTQ4WNjKEvdF4+nQ+m1yvcc6Ou647XngBHsGcoAAAANCGVeb7NDcoj7UbOjlDoB7CUEeT1ISgAAAA0IDYXXe15J5aKZ77rDpn6lbXdW+FoeRACAoAAADtWKXD03BkvrXuvJy3YejFaDytab5ZCiIEBQAAgEas2A26OxpP9xa20qw4v+fJI/Y/zEn7+2g8vRSGMjQLIwEAAEBbwkJB/1pyj0PnqCA0P28eGVAfP2Lhq3BNvIrdneu6DUPDtXhg5XeGIAQFAACAhsxnk9PReHoeF675Ed2gedp/5LsKoeNaIWgIT2N4+fvCi6vb6bruj3g9HgpD6ZPh8AAAANAeK8Wztjitwi8bPIK7MQw9syAXfRGCAgAAQGNix935knu9a0g834pB6M8rzDG7jHCt/Xs0nh4LQ9k0w+EBAAAGtObQYmEAfQgdnn8s+fceLGyheTFMfzYaTw/jNfKYeULvCsP990fj6UkcJr/u/KXwX0JQAACAYS0bOkGvQoC1wtygmwq3ejUaT592XffiEf/GpcBtdfPZ5HA0nh7FIHTTYeir+HcfxdXpYS1CUAAAAGjXKt2gJXjxyP15Zw7U9cSA8m4Y+nZDf/VW/LsOQsfpfDY5WvgJWII5QQEAAOpidWWWtuLcoCUwdURiIQwNnaFd1/1P13UnG3w3IQz9Z1w86enCq/ADQlAAAIC6XDifrKimzkchaCbCtALz2eRND2FomL5BEMrKhKAAAAD1ODFnHquqrBvUKvaZuROG/t8NXmc7XdcdL2yFB5gTFAAAoB69dPSNxtMvCxupTS1zg7bSHfix67rHPPAY/GHJfDYJXep7o/F0L15vyyzI9ZCX4e+KIT78kBAUAACgDr9Y1Zp1rbhSfM52GrkIDkoN/+L7vg1Djx55zg51/7Isw+EBAADK94/5bGJoKI91UPIRHI2nLxY2kq0Qhs5nk3DOfum67mrN97lrblCWJQQFAAAoVwgOfp7PJkfOIY8VhytvcgGboQnDChQe4Mxnk2ePCEOF3yxFCAoAAFCWMGT5txh+PjMfHhtW8krxhkUXLHazh0DzXdd1NyvsifPOUswJCgAAMKyf7/xrqy4O8oth7/QpzCs7Gk9DN+h+gQf62cIWBheHp4cw83LVeYrns0lYsOlwNJ6G/3y78APwCEJQAACAAd3t3ByNp6uuyB1+XghK3w5LDEHns8mbruvefLt9NJ6eVbDgU1ZG4+mzGDq/iNMQ3HZj3j3O7wrvLKYyhsMDAAAkEgPR8xX+9e3ReLoQ8sAmxe69kucGpSfhwc1oPP3Sdd2/4wOcf8aOzV1BM7kTggIAAKS1aqips4ohuM6AqghBAQAAElqj6043KL3TDQrUxpygAAAA6a06B+PRaDw9jYuIDOHnNf+No67rdha2Uooi5wYFuI8QFAAAILE1VuTe6rruYKghy3cXc1rFaDwdKqSlB4WvFA/wFcPhAQAA8rBqoHkwGk+fLmyFzTI3KFAFISgAAEAG4hyMv63wTm67QaE35gaFfIzG02ej8XQvrtL/Kvy307M8ISgAAEA+QtfdzQrvRjcoQzhY8boENijc50fj6XHXdf/uuu6Pruvedl33r/Dfo/H0bDSevnC8f8ycoAAAAJkICx2NxtOj+AV3GYPODVqa0Xj6pfVjsAlrXJd9+GM0ng7x71wubMlTH8fj53Xn//2Ot6PxNOU1U4X4oOvsgUXmdsProUN0PptcLLzKf+kEBQAAyMvRil13bw2JZACbDMdu5RjYlBKC8pfaF2A7fSAAvbUVf44HCEEBAAAyErruYhC6Cp2g6Vy1uuMbkGN4VXug9lg5hsTVdj/GYe67Cy/cb3s0nr659xX+QwgKAACQn1W7Qfd1gybTR4dkK3I7djeGE/9Qdtf7hofw5+bViu9nb2EL/yUEBQAAyEzsBl21u1M3aBrHLe70JsTwKqdOWsOJf2A+m4RO0I8P/9SgTjJ6LznwMOwBQlAAAIAMzWeToxUDIt2gwzuvvAttCDmF9x4kLCen47Tq1CE0TAgKAACQr1XDBoHAcG7iyvw8wnw2CZ205xkcw19ilyM/MJ9NTjPpwHzXwPQFq16THso8QAgKAACQqRgQrdIN+nI0npoTrn8hAN0zf+TGvEo8xPpd/F1jeeEBwIeEx+tkPpu00Ll7uuL80K7jBwhBAQAA8mZu0LyErsUXAtDNCXPgzmeTsAr2u4H/6fCA4e+NhGkbFc/Zq3jOVgnpHusmnrMmVkGP80Mv23H+m27mhwlBAQAAMrZGN+iubtCNu4rDf3+ezyZ7goZ+xDDyf7qu+0ePQ+RvYgdjGP7+LA7tZk3xnD0b8Jw9be2cxc+AXxZe+FrojDU9xw/89PDLAAAAWTteYQ60PoOrnxe2bNbeiqv+LrOvfb/nLnYwPV3Yer9lOyuHeN+3rjfY8XnR03sf6nis8v6vF7YsKQbMR7fz247G03D9vNjEDhSwiNUqvy99WOtaj92KNZ6zIe81DwpB6Gg8PYud/uHY7sQpJMI5O7ZA23L+9uXLlxLeJwAAAADAWgyHBwAAAACqJgQFAAAAAKomBAUAAAAAqiYEBQAAAACqJgQFAAAAAKomBAUAAAAAqiYEBQAAAACqJgQFAAAAAKomBAUAAAAAqiYEBQAAAACqJgQFAAAAAKomBAUAAAAAqiYEBQAAAACqJgQFAAAAAKomBAUAAAAAqiYEBQAAAACqJgQFAAAAAKomBAUAAAAAqiYEBQAAAACqJgQFAAAAAKomBAUAAAAAqiYEBQAAAADq1XXd/wcqGlV6QeZMWQAAAABJRU5ErkJggg==";
let settings = {};
let appUsers = [];
let appRoles = [];
let editingUserId = null;
let selectedRoleId = null;
let deliveryTerms = [];
let paymentTerms = [];
let editingSupId = null;
let editingRFQId = null;
let navFromQuoteId = null;  // tracks if user navigated here from a quotation
let pricingRFQId = null;
let rfqFilter = 'all';
let rfqDateFilter = { preset: 'all', from: '', to: '' };
let rfqAttachment = null;
let pricingAttachment = null;
let pricingVendorQuotes = [];
let pricingSupplierName = '';
let pricingDirty = false;
let pricingSaved = false;
let pricingInternalCosts = [];
let pricingDragRow = null;
let pricingDragFocus = null;
let pricingDraftSaveTimer = null;
let pricingDraftSaveSequence = 0;
let pricingSaveInProgress = false;
let pricingConvertInProgress = false;
let pricingReorderHadPriorDirty = false;

function ensurePricingVersions(r) {
  if (!r) return [];
  if (!Array.isArray(r.pricingVersions) || !r.pricingVersions.length) {
    if (Array.isArray(r.pricingItems) && r.pricingItems.length) {
      r.pricingVersions = [{
        version: 1,
        status: r.quotationId ? 'Converted' : 'Saved',
        revisionReason: '',
        created: r.created || new Date().toISOString(),
        updated: new Date().toISOString(),
        convertedDate: r.quotationId ? (r.quotedDate || new Date().toISOString()) : null,
        quotationId: r.quotationId || null,
        supplierName: r.supplierName || '', supRef: r.supRef || '', supDate: r.supDate || '',
        pricingItems: JSON.parse(JSON.stringify(r.pricingItems || [])),
        internalCosts: JSON.parse(JSON.stringify(r.internalCosts || [])),
        vendorQuotes: JSON.parse(JSON.stringify(r.vendorQuotes || [])),
        pricingAttachment: r.pricingAttachment || null,
        internalNotes: r.internalNotes || ''
      }];
      r.currentPricingVersion = 1;
    } else {
      r.pricingVersions = [];
      r.currentPricingVersion = 1;
    }
  }
  if (!r.currentPricingVersion) r.currentPricingVersion = Math.max(1, ...r.pricingVersions.map(v=>Number(v.version)||1));
  return r.pricingVersions;
}
function getCurrentPricingVersion(r) {
  const versions=ensurePricingVersions(r);
  return versions.find(v=>Number(v.version)===Number(r.currentPricingVersion)) || versions[versions.length-1] || null;
}
function syncRFQFromPricingVersion(r,v) {
  if(!r||!v)return;
  r.currentPricingVersion=Number(v.version)||1;
  r.pricingItems=JSON.parse(JSON.stringify(v.pricingItems||[]));
  r.internalCosts=JSON.parse(JSON.stringify(v.internalCosts||[]));
  r.vendorQuotes=JSON.parse(JSON.stringify(v.vendorQuotes||[]));
  r.pricingAttachment=v.pricingAttachment||null;
  r.internalNotes=v.internalNotes||'';
  r.supplierName=v.supplierName||''; r.supRef=v.supRef||''; r.supDate=v.supDate||'';
}
function isPricingVersionLocked(r) {
  const v=getCurrentPricingVersion(r);
  return !!v && ['Converted','Superseded','Cancelled'].includes(v.status);
}
function nextQuotationRevisionNo(r) {
  const linked=(r.quotationIds||[]).map(id=>quotations.find(q=>q.id===id)).filter(Boolean);
  const base=linked[0]?.qno || (r.quotationId ? quotations.find(q=>q.id===r.quotationId)?.qno : '') || '';
  const clean=String(base||'').replace(/-R\d+$/i,'');
  const rev=Math.max(0,...linked.map(q=>Number(q.revisionNo)||0))+1;
  return {baseQno:clean, revisionNo:rev, revisionOf:linked[0]?.id || r.quotationId || null};
}

function resolvePendingQuotationRevision(){
  const pending=document._pendingQuotationRevision;
  if(!pending) return null;

  let baseQno=String(pending.baseQno||'').replace(/-R\d+$/i,'');
  let revisionOf=pending.revisionOf||pending.sourceQuotationId||null;

  if(pending.sourceQuotationId){
    const source=quotations.find(q=>q.id===pending.sourceQuotationId);
    if(source){
      baseQno=String(source.qno||baseQno).replace(/-R\d+$/i,'');
      revisionOf=source.revisionOf||source.id;
    }
  }

  if(!baseQno && pending.rfqId){
    const r=rfqs.find(x=>x.id===pending.rfqId);
    if(r){
      const info=nextQuotationRevisionNo(r);
      baseQno=info.baseQno;
      revisionOf=info.revisionOf;
    }
  }

  if(!baseQno) return null;

  const family=quotations.filter(q=>{
    const qBase=String(q.qno||'').replace(/-R\d+$/i,'');
    return qBase===baseQno;
  });
  const revisionNo=Math.max(0,...family.map(q=>Number(q.revisionNo)||0))+1;
  return {
    qno:baseQno+'-R'+revisionNo,
    baseQno,
    revisionNo,
    revisionOf:revisionOf || family[0]?.id || null
  };
}
let editingId = null;
let editingCustId = null;
let editingProdId = null;
let selectedCustId = null;
let currentQuoteType = 'product';
let currentPage = 1;
let prodPage = 1;
let rfqPage = 1;
let pricingDocPage = 1;
let soPage = 1;
let customerPage = 1;
let supplierPage = 1;
let employeePage = 1;
const ROWS_PER_PAGE_OPTIONS = [15,25,50,100,200];
function getRowsPerPage(){
  const v = parseInt(localStorage.getItem('bc-rows-per-page'),10);
  return ROWS_PER_PAGE_OPTIONS.includes(v) ? v : 15;
}
function setRowsPerPage(v){
  v = parseInt(v,10);
  if(!ROWS_PER_PAGE_OPTIONS.includes(v)) return;
  localStorage.setItem('bc-rows-per-page', v);
  PER_PAGE = v; PROD_PER_PAGE = v; RFQ_PER_PAGE = v; PRICING_DOC_PER_PAGE = v; SO_PER_PAGE = v;
  currentPage = 1; prodPage = 1; rfqPage = 1; pricingDocPage = 1; soPage = 1; customerPage = 1; supplierPage = 1; employeePage = 1;
  document.querySelectorAll('.rows-per-page-select').forEach(el=>{ el.value = v; });
  renderTable();
  renderProducts();
  if (document.getElementById('page-rfq')?.classList.contains('active')) renderRFQPage();
  if (document.getElementById('page-costing')?.classList.contains('active')) renderPricingDocuments();
  if (document.getElementById('page-salesorders')?.classList.contains('active')) renderSOPage();
  if (document.getElementById('masters-tab-customers')?.classList.contains('active')) renderCustomers();
  if (document.getElementById('masters-tab-suppliers')?.classList.contains('active')) renderSuppliers();
  if (document.getElementById('masters-tab-employees')?.classList.contains('active')) renderEmployees();
}
let PER_PAGE = getRowsPerPage();
let PROD_PER_PAGE = getRowsPerPage();
let RFQ_PER_PAGE = getRowsPerPage();
let PRICING_DOC_PER_PAGE = getRowsPerPage();
let SO_PER_PAGE = getRowsPerPage();

/* Builds a compact "◀ 1 … 4 5 6 … 8 ▶" pagination control.
   fn = name of the global function to call with the target page number. */
function buildPaginationHTML(current, total, fn) {
  if (total <= 1) return '';
  const btn = (p, label, disabled, active) =>
    `<button ${disabled?'disabled':''} class="${active?'active':''}" onclick="${fn}(${p})" aria-label="${typeof label==='number'?'Page '+label:label}">${label}</button>`;
  let html = btn(current-1, '◀', current<=1, false);
  const pages = [1];
  if (current > 3) pages.push('…');
  for (let p = Math.max(2, current-1); p <= Math.min(total-1, current+1); p++) pages.push(p);
  if (current < total-2) pages.push('…');
  if (total > 1) pages.push(total);
  pages.forEach(p => {
    html += p === '…' ? `<span class="pg-ellipsis">…</span>` : btn(p, p, false, p===current);
  });
  html += btn(current+1, '▶', current>=total, false);
  return html;
}
const DEFAULT_UOM_MASTER = [
  {id:'uom-pcs',code:'Pcs',name:'Pieces',decimals:0,step:1,active:true},
  {id:'uom-box',code:'Box',name:'Box',decimals:0,step:1,active:true},
  {id:'uom-pkt',code:'Pkt',name:'Packet',decimals:0,step:1,active:true},
  {id:'uom-set',code:'Set',name:'Set',decimals:0,step:1,active:true},
  {id:'uom-roll',code:'Roll',name:'Roll',decimals:0,step:1,active:true},
  {id:'uom-reel',code:'Reel',name:'Reel',decimals:0,step:1,active:true},
  {id:'uom-ltr',code:'Ltr',name:'Litre',decimals:2,step:0.01,active:true},
  {id:'uom-kg',code:'Kg',name:'Kilogram',decimals:3,step:0.001,active:true},
  {id:'uom-ea',code:'EA',name:'Each',decimals:0,step:1,active:true},
  {id:'uom-mtr',code:'Mtr',name:'Metre',decimals:2,step:0.01,active:true},
  {id:'uom-pair',code:'Pair',name:'Pair',decimals:0,step:1,active:true},
  {id:'uom-bundle',code:'Bundle',name:'Bundle',decimals:0,step:1,active:true},
  {id:'uom-tube',code:'Tube',name:'Tube',decimals:0,step:1,active:true},
  {id:'uom-can',code:'Can',name:'Can',decimals:0,step:1,active:true},
  {id:'uom-bag',code:'Bag',name:'Bag',decimals:0,step:1,active:true},
  {id:'uom-nos',code:'Nos',name:'Numbers',decimals:0,step:1,active:true},
  {id:'uom-job',code:'Job',name:'Job',decimals:0,step:1,active:true},
  {id:'uom-hour',code:'Hours',name:'Hours',decimals:2,step:0.25,active:true},
  {id:'uom-day',code:'Days',name:'Days',decimals:1,step:0.5,active:true},
  {id:'uom-lumpsum',code:'Lump sum',name:'Lump sum',decimals:0,step:1,active:true}
];
let uomMaster=[];
let editingUomId=null;
function loadUomMaster(){
  try{uomMaster=JSON.parse(localStorage.getItem('bizcore_uom_master')||'[]');}catch(e){uomMaster=[];}
  if(!Array.isArray(uomMaster)||!uomMaster.length) uomMaster=DEFAULT_UOM_MASTER.map(x=>({...x}));
  uomMaster=uomMaster.map((u,i)=>({id:u.id||('uom-'+Date.now()+'-'+i),code:String(u.code||'').trim(),name:String(u.name||u.code||'').trim(),decimals:Math.max(0,Math.min(3,Number(u.decimals)||0)),step:Number(u.step)>0?Number(u.step):1,active:u.active!==false})).filter(u=>u.code);
  localStorage.setItem('bizcore_uom_master',JSON.stringify(uomMaster));
}
loadUomMaster();
let UOM_LIST = uomMaster.filter(u=>u.active).map(u=>u.code);

/* ── STORAGE ── */
/* ══════════════════════════════════════════════════
   THEME & FONT SIZE
══════════════════════════════════════════════════ */
const THEMES = {
  blue:     {sidebar:'#173A5E', mid:'#2E75B6', light:'#DCE6F0', pale:'#EBF3FB', active:'#FFFFFF'},
  darkblue: {sidebar:'#1a5276', mid:'#2471a3', light:'#aed6f1', pale:'#d6eaf8', active:'#FFFFFF'},
  green:    {sidebar:'#145a32', mid:'#1e8449', light:'#a9dfbf', pale:'#d5f5e3', active:'#FFFFFF'},
  purple:   {sidebar:'#6e2fa0', mid:'#8e44ad', light:'#d2b4de', pale:'#f4ecf7', active:'#FFFFFF'},
  red:      {sidebar:'#922b21', mid:'#c0392b', light:'#f1948a', pale:'#fdedec', active:'#FFFFFF'},
  dark:     {sidebar:'#1a252f', mid:'#2e4057', light:'#85929e', pale:'#eaecee', active:'#FFFFFF'},
  slate:    {sidebar:'#2c3e50', mid:'#34495e', light:'#95a5a6', pale:'#eaf0fb', active:'#FFFFFF'},
  teal:     {sidebar:'#117a8b', mid:'#138d75', light:'#76d7c4', pale:'#e8f8f5', active:'#FFFFFF'},
};

function applyTheme(name) {
  const t = THEMES[name]; if (!t) return;
  const r = document.documentElement.style;
  r.setProperty('--blue',         t.sidebar);
  r.setProperty('--blue-mid',     t.mid);
  r.setProperty('--blue-light',   t.light);
  r.setProperty('--blue-pale',    t.pale);
  r.setProperty('--sidebar-bg',   t.sidebar);
  r.setProperty('--sidebar-active', t.active);
  r.setProperty('--sidebar-active-text', t.sidebar);
  r.setProperty('--accent',       t.mid);
  // Keep the professional selector and colour preview in sync
  const selector = document.getElementById('theme-select');
  if (selector) selector.value = name;
  const preview = document.getElementById('theme-preview');
  if (preview) preview.style.background = t.mid;
  // Persist
  try { localStorage.setItem('dtq_theme', name); } catch(e) {}
}

const FONT_SIZES = [11, 12, 13, 14, 15];
let currentFontIdx = 2; // default 13px

function changeFontSize(dir) {
  if (dir === 0) currentFontIdx = 2;
  else currentFontIdx = Math.max(0, Math.min(FONT_SIZES.length-1, currentFontIdx + dir));
  const sz = FONT_SIZES[currentFontIdx];
  // Set on html element so ALL elements inherit (the universal cascade fix)
  document.documentElement.style.fontSize = sz + 'px';
  // Also update CSS vars for elements that use them explicitly
  const r = document.documentElement.style;
  r.setProperty('--fs-base',  sz+'px');
  r.setProperty('--fs-sm',    Math.max(9, sz-2)+'px');
  r.setProperty('--fs-label', Math.max(9, sz-2)+'px');
  r.setProperty('--fs-input', sz+'px');
  // Scale modal/table/badge font sizes proportionally
  const scale = sz / 13;
  r.setProperty('--scale', scale.toFixed(3));
  // Show current size indicator
  const indicator = document.getElementById('fs-indicator');
  if (indicator) indicator.textContent = sz+'px';
  try { localStorage.setItem('dtq_fontidx', currentFontIdx); } catch(e) {}
}

function loadThemeAndFont() {
  try {
    const t = localStorage.getItem('dtq_theme');
    applyTheme(t && THEMES[t] ? t : 'blue');
    localStorage.removeItem('dtq_fontidx');
    document.documentElement.style.fontSize = '';
  } catch(e) { applyTheme('blue'); }
}



async function loadData() {
  // ── Load from Firebase first (shared cloud data) ──
  if (window.FB) {
    try {
      const [fbQ, fbC, fbSup, fbP, fbDT, fbPT, fbR, fbE, fbSO, fbSet] = await Promise.all([
        window.FB.fbLoad('quotations'),
        window.FB.fbLoad('customers'),
        window.FB.fbLoad('suppliers'),
        window.FB.fbLoad('products'),
        window.FB.fbLoad('deliveryTerms'),
        window.FB.fbLoad('paymentTerms'),
        window.FB.fbLoad('rfqs'),
        window.FB.fbLoad('employees'),
        window.FB.fbLoad('salesOrders'),
        window.FB.fbLoadSettings(),
      ]);
      if (fbQ   && fbQ.length)    quotations    = fbQ;
      if (fbC   && fbC.length)    customers     = fbC;
      if (fbP   && fbP.length)    products      = fbP;
      if (fbDT  && fbDT.length)   deliveryTerms = fbDT;
      if (fbPT  && fbPT.length)   paymentTerms  = fbPT;
      if (fbSup && fbSup.length)  suppliers     = fbSup;
      if (fbR   && fbR.length)    rfqs          = fbR;
      if (fbE   && fbE.length)    employees     = fbE;
      if (fbSO  && fbSO.length)   salesOrders   = fbSO;
      if (fbSet && fbSet.coname)  settings      = fbSet;
      console.log('Data loaded from Firebase ✅');

      // ── Real-time listeners: auto-update when another device saves ──
      // Uses smart refresh — updates data in background, only re-renders
      // the currently active page so users are never navigated away
      if (window.FB.fbListen) {

        // Helper: get the currently active page ID
        function getActivePage() {
          const active = document.querySelector('.page.active');
          return active ? active.id.replace('page-','') : 'dashboard';
        }

        // Helper: show a subtle "Updated" badge without disrupting the user
        function showSyncBadge(label) {
          let badge = document.getElementById('rt-sync-badge');
          if (!badge) {
            badge = document.createElement('div');
            badge.id = 'rt-sync-badge';
            badge.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);'
              + 'background:rgba(11,83,157,.9);color:#fff;font-size:11px;padding:5px 14px;'
              + 'border-radius:20px;z-index:9999;pointer-events:none;'
              + 'transition:opacity .4s;white-space:nowrap';
            document.body.appendChild(badge);
          }
          badge.textContent = '🔄 ' + label + ' updated by another user';
          badge.style.opacity = '1';
          clearTimeout(badge._t);
          badge._t = setTimeout(function() { badge.style.opacity = '0'; }, 2500);
        }

        // First Firestore snapshot is initial synchronization, not a remote edit.
        // Suppress the "updated by another user" badge until each listener has initialized.
        const _rtListenerInitialized = new Set();

        // Helper: smart render — only re-render if user is on that page
        // and not currently editing anything (no open modal)
        function smartRender(page, renderFn, label) {
          const isInitialSync = !_rtListenerInitialized.has(label);
          if (isInitialSync) _rtListenerInitialized.add(label);

          // Don't interrupt if a modal is open
          const modalOpen = document.querySelector('.modal-overlay.open, .modal-overlay[style*="flex"]');
          if (modalOpen) {
            if (!isInitialSync) showSyncBadge(label);
            return;
          }
          const active = getActivePage();
          if (active === page || active === 'dashboard') {
            renderFn();
          }
          if (!isInitialSync) showSyncBadge(label);
        }

        window.FB.fbListen('quotations', function(data) {
          quotations = data;
          try { localStorage.setItem('dtq_quotations', JSON.stringify(quotations)); } catch(e) {}
          smartRender('quotations', function() {
            renderTable();
            renderDashboard();
          }, 'Quotations');

          // Pricing register contains live quotation links, so quotation
          // synchronization must refresh Pricing too when that module is open.
          if (getActivePage()==='costing') {
            const modalOpen=document.querySelector('.modal-overlay.open, .modal-overlay[style*="flex"]');
            if(!modalOpen && typeof renderPricingDocuments==='function') renderPricingDocuments();
          }
        });

        window.FB.fbListen('customers', function(data) {
          customers = data;
          try { localStorage.setItem('dtq_customers', JSON.stringify(customers)); } catch(e) {}
          smartRender('masters', function() {
            if (typeof renderCustomers === 'function') renderCustomers();
            renderSetupCustTable();
          }, 'Customers');
        });

        window.FB.fbListen('suppliers', function(data) {
          suppliers = data;
          try { localStorage.setItem('dtq_suppliers', JSON.stringify(suppliers)); } catch(e) {}
          smartRender('masters', function() {
            if (typeof renderSuppliers === 'function') renderSuppliers();
          }, 'Suppliers');
        });

        window.FB.fbListen('products', function(data) {
          products = data;
          try { localStorage.setItem('dtq_products', JSON.stringify(products)); } catch(e) {}
          smartRender('masters', function() {
            if (typeof renderProducts === 'function') renderProducts();
          }, 'Products');
        });

        window.FB.fbListen('rfqs', function(data) {
          rfqs = data;
          try { localStorage.setItem('dtq_rfqs', JSON.stringify(rfqs)); } catch(e) {}
          smartRender('rfq', function() {
            if (typeof renderRFQPage === 'function') renderRFQPage();
            renderDashboard();
          }, 'RFQs');

          // Pricing documents are stored inside RFQ pricing versions.
          if (getActivePage()==='costing') {
            const modalOpen=document.querySelector('.modal-overlay.open, .modal-overlay[style*="flex"]');
            if(!modalOpen && typeof renderPricingDocuments==='function') renderPricingDocuments();
          }
        });

        window.FB.fbListen('salesOrders', function(data) {
          salesOrders = data;
          try { localStorage.setItem('dtq_salesorders', JSON.stringify(salesOrders)); } catch(e) {}
          smartRender('salesorders', function() {
            if (typeof renderSOPage === 'function') renderSOPage();
            renderDashboard();
          }, 'Sales Orders');
          // A QR deep-link may arrive before Firebase Sales Orders finish loading.
          // Retry routing immediately after the authoritative SO/DN data arrives.
          if (typeof openDNFromDeepLink === 'function') setTimeout(openDNFromDeepLink, 0);
        });

        window.FB.fbListen('employees', function(data) {
          employees = data;
          try { localStorage.setItem('dtq_employees', JSON.stringify(employees)); } catch(e) {}
          smartRender('masters', function() {
            if (typeof renderEmployees === 'function') renderEmployees();
          }, 'Employees');
        });

        window.FB.fbListenSettings(function(data) {
          if (data && data.coname) {
            settings = data;
            try { localStorage.setItem('dtq_settings', JSON.stringify(settings)); } catch(e) {}
            if (typeof applySettings === 'function') applySettings();
          }
        });

        console.log('Real-time listeners active ✅ — smart background sync enabled');
      }
    } catch(e) {
      console.warn('Firebase load error, falling back to localStorage:', e.message);
    }
  }

  // ── Fall back to localStorage if Firebase load failed or returned nothing ──
  try {
    if (!quotations.length) { const r=localStorage.getItem('dtq_quotations'); if(r) quotations=JSON.parse(r); }
    if (!customers.length)  { const r=localStorage.getItem('dtq_customers');  if(r) customers=JSON.parse(r); }
    if (!settings.coname)   { const r=localStorage.getItem('dtq_settings');   if(r) settings=JSON.parse(r); }
    if (!products.length)   { const r=localStorage.getItem('dtq_products');   if(r) products=JSON.parse(r); }
    if (!deliveryTerms.length){ const r=localStorage.getItem('dtq_delivery_terms'); if(r) deliveryTerms=JSON.parse(r); }
    if (!paymentTerms.length) { const r=localStorage.getItem('dtq_payment_terms');  if(r) paymentTerms=JSON.parse(r); }
    if (!suppliers.length)  { const r=localStorage.getItem('dtq_suppliers');   if(r) suppliers=JSON.parse(r); }
    if (!rfqs.length)       { const r=localStorage.getItem('dtq_rfqs');        if(r) rfqs=JSON.parse(r); }
    if (!employees.length)  { const r=localStorage.getItem('dtq_employees');   if(r) employees=JSON.parse(r); }
    if (!salesOrders.length){ const r=localStorage.getItem('dtq_salesorders'); if(r) salesOrders=JSON.parse(r); }
    // Clean up old demo seed
    const demoIds=['emp-musthafa','emp-shabeeb','emp-sajeer'];
    const untouchedDemo=employees.length===3&&demoIds.every(id=>employees.some(e=>e.id===id))&&employees.every(e=>!e.iqamaNo&&!e.passportNo&&!e.licenseNo&&!e.email&&!e.mobile);
    if(untouchedDemo){ employees=[]; localStorage.removeItem('dtq_employees'); }
  } catch(e) {}

  // Always seed from built-in data if still empty
  if (!quotations.length) quotations = getSampleData();
  if (!customers.length) customers = getDefaultCustomers();
  if (!settings.coname) settings = getDefaultSettings();
  ensureCurrencyDisplaySettings();
  if (!settings.logo) settings.logo = DEFAULT_LOGO_B64;
  if (!products.length) products = getDefaultProducts();
  if (!deliveryTerms.length) deliveryTerms = getDefaultDeliveryTerms();
  if (!paymentTerms.length)  paymentTerms  = getDefaultPaymentTerms();
  if (!suppliers.length) suppliers = [];
  if (!rfqs.length) rfqs = [];
  if (!employees.length) employees = getDefaultEmployees();
  if (!salesOrders.length) salesOrders = [];
  // v102: harden Customer/Supplier relationships. Existing test records are upgraded
  // only when a single unambiguous master match exists; no name guess is made.
  const relationshipIdsMigrated=migrateMasterRelationshipIds();
  if(relationshipIdsMigrated.quotations) await saveQuotations();
  if(relationshipIdsMigrated.rfqs) await saveRFQs();
  if(relationshipIdsMigrated.salesOrders) await saveSalesOrders();
  // One-time VAT integrity migration: historical quotations without an explicit
  // snapshot are stamped with the legacy 15% rate before any master-rate changes
  // can affect their label, totals, preview, print, or register values.
  const vatSnapshotsMigrated=migrateQuotationVatSnapshots();
  if(vatSnapshotsMigrated) await saveQuotations();
  // One-time cleanup: fix quantities saved with floating-point/decimal drift (e.g. 9.01, 49.999999994)
  salesOrders.forEach(so => {
    (so.items||[]).forEach(it => { if (it.qty != null) it.qty = roundQtyForUom(it.qty, it.uom); });
    (so.deliveries||[]).forEach(d => {
      (d.items||[]).forEach(it => { if (it.qty != null) it.qty = roundQtyForUom(it.qty, it.uom); });
    });
  });
  // Migrate old statuses (Won/Lost/No Response) → Quoted (closest logical equivalent)
  rfqs.forEach(r => {
    if (['Won','Lost','No Response'].includes(r.status)) r.status = 'Quoted';
  });

  // Persist to localStorage
  try { localStorage.setItem('dtq_quotations', JSON.stringify(quotations)); } catch(e) {}
  try { localStorage.setItem('dtq_customers', JSON.stringify(customers)); } catch(e) {}
  try { localStorage.setItem('dtq_settings', JSON.stringify(settings)); } catch(e) {}
  try { localStorage.setItem('dtq_products', JSON.stringify(products)); } catch(e) {}
  try { localStorage.setItem('dtq_delivery_terms', JSON.stringify(deliveryTerms)); } catch(e) {}
  try { localStorage.setItem('dtq_payment_terms', JSON.stringify(paymentTerms)); } catch(e) {}
  try { localStorage.setItem('dtq_suppliers', JSON.stringify(suppliers)); } catch(e) {}
  try { localStorage.setItem('dtq_rfqs', JSON.stringify(rfqs)); } catch(e) {}
  try { localStorage.setItem('dtq_employees', JSON.stringify(employees)); } catch(e) {}
  try { localStorage.setItem('dtq_salesorders', JSON.stringify(salesOrders)); } catch(e) {}
  repairIncompleteQuotationDates();
  applySettings();
  loadAccessSetup();
  refreshProductUomSelect();
  renderAll();
}

async function saveQuotations() {
  try { localStorage.setItem('dtq_quotations', JSON.stringify(quotations)); } catch(e) {}
  if (window.FB) await window.FB.fbSave('quotations', quotations);
}
async function saveCustomers() {
  try { localStorage.setItem('dtq_customers', JSON.stringify(customers)); } catch(e) {}
  if (window.FB) await window.FB.fbSave('customers', customers);
}
async function saveEmployees() {
  try { localStorage.setItem('dtq_employees', JSON.stringify(employees)); } catch(e) {}
  if (window.FB) await window.FB.fbSave('employees', employees);
}
async function saveSettings() {
  try { localStorage.setItem('dtq_settings', JSON.stringify(settings)); } catch(e) {}
  if (window.FB) await window.FB.fbSaveSettings(settings);
}
async function saveProducts() {
  try { localStorage.setItem('dtq_products', JSON.stringify(products)); } catch(e) {}
  try { localStorage.setItem('dtq_delivery_terms', JSON.stringify(deliveryTerms)); } catch(e) {}
  try { localStorage.setItem('dtq_payment_terms', JSON.stringify(paymentTerms)); } catch(e) {}
  try { localStorage.setItem('dtq_suppliers', JSON.stringify(suppliers)); } catch(e) {}
  try { localStorage.setItem('dtq_rfqs', JSON.stringify(rfqs)); } catch(e) {}
  if (window.FB) {
    await window.FB.fbSave('products', products);
    await window.FB.fbSave('deliveryTerms', deliveryTerms);
    await window.FB.fbSave('paymentTerms', paymentTerms);
  }
}
async function saveTerms() {
  try { localStorage.setItem('dtq_delivery_terms', JSON.stringify(deliveryTerms)); } catch(e) {}
  try { localStorage.setItem('dtq_payment_terms',  JSON.stringify(paymentTerms));  } catch(e) {}
}
async function saveSalesOrders() {
  try { localStorage.setItem('dtq_salesorders', JSON.stringify(salesOrders)); } catch(e) {}
  if (window.FB) await window.FB.fbSave('salesOrders', salesOrders);
}

/* ── SAMPLE DATA ── */
function getSampleData() { return [{"id": "Q-2606-3960", "qno": "Q-2606-3960", "date": "2026-06-27", "company": "SD Middle East LLC", "contact": "Ms. Anna", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Roco Printing Paper A4 (500Pcs/Rm) 5Rm/Box", "qty": 100.0, "uom": "Box", "up": 79.0}, {"code": "", "desc": "Roco Printing Paper A3 (500Pcs/Rm) 5Rm/Box", "qty": 100.0, "uom": "Box", "up": 163.0}, {"code": "", "desc": "Superdeal Button File Bag White Transparent", "qty": 500.0, "uom": "Pkt", "up": 11.0}, {"code": "", "desc": "Clip Box File Normal Black", "qty": 100.0, "uom": "Pcs", "up": 7.5}, {"code": "", "desc": "Super Deal 21G Pvp Glue Stick-White", "qty": 50.0, "uom": "Pcs", "up": 3.0}, {"code": "", "desc": "Deluxe 32Mm Binderclip 12Pcs/Pkt", "qty": 50.0, "uom": "Pkt", "up": 25.0}, {"code": "", "desc": "Deluxe 25Mm Binder Clip 1 Inch 12Pcs/Pkt", "qty": 50.0, "uom": "Pkt", "up": 23.0}, {"code": "", "desc": "Super Deal Clear Stationery Tape3/4 X 30Y 10Pcs/Pkt", "qty": 50.0, "uom": "Pkt", "up": 10.0}, {"code": "", "desc": "Roco Metal Stapler 20 Sheet", "qty": 50.0, "uom": "Pcs", "up": 18.5}, {"code": "", "desc": "Kangaro Staples 26/6 (1000) 20Pkt/Box", "qty": 25.0, "uom": "Box", "up": 26.0}, {"code": "", "desc": "Deli Punch 20 Page Capacity (Asst)", "qty": 50.0, "uom": "Pcs", "up": 13.0}, {"code": "", "desc": "Cello Trimate Blue 1Mm 10Pcs Box", "qty": 50.0, "uom": "Pkt", "up": 6.0}, {"code": "", "desc": "Deluxe Amt Corection Pen 10Ml", "qty": 50.0, "uom": "Pcs", "up": 2.2}, {"code": "", "desc": "Fantastick Notes Fkn303 Ylw  12/Pkt", "qty": 50.0, "uom": "Pcs", "up": 13.5}, {"code": "", "desc": "Lotus Highlighter Set-4Pcs/Pkt", "qty": 250.0, "uom": "Pkt", "up": 5.9}, {"code": "", "desc": "Tissue Paper Box", "qty": 1000.0, "uom": "Box", "up": 3.0}, {"code": "", "desc": "Atlas 12X10 Envelope A4 Brown", "qty": 10.0, "uom": "Pkt", "up": 8.5}, {"code": "", "desc": "Super Deal (A4) Laminating Pouch 125 Microne  216X303", "qty": 10.0, "uom": "Pkt", "up": 37.0}, {"code": "", "desc": "Super Deal (A3) Laminating Pouch 125 Micron  303X426", "qty": 10.0, "uom": "Pkt", "up": 59.0}, {"code": "", "desc": "Deli Steel Ruler 30Cm", "qty": 10.0, "uom": "Pcs", "up": 5.5}, {"code": "", "desc": "Nescafe Gold 190G", "qty": 100.0, "uom": "Pcs", "up": 39.0}, {"code": "", "desc": "Nescafe Red Mug 95G", "qty": 100.0, "uom": "Pcs", "up": 27.5}, {"code": "", "desc": "Coffemate (400Gm)", "qty": 100.0, "uom": "Pcs", "up": 16.0}, {"code": "", "desc": "Lipton Tea 100 Bag", "qty": 100.0, "uom": "Pcs", "up": 14.0}, {"code": "", "desc": "Lipton Green Tea 100 Bag", "qty": 100.0, "uom": "Pcs", "up": 14.5}, {"code": "", "desc": "Evaporated Milk (160Ml Can)", "qty": 500.0, "uom": "Pcs", "up": 3.0}, {"code": "", "desc": "White Sugar Packet (500Gm)", "qty": 100.0, "uom": "Pkt", "up": 10.0}, {"code": "", "desc": "Star Tea Cup 9Oz 50pcs/Pkt", "qty": 10.0, "uom": "Pkt", "up": 6.0}, {"code": "", "desc": "Plastic Spoon (Table Spoon Type)", "qty": 50.0, "uom": "Pkt", "up": 2.5}, {"code": "", "desc": "Paper Plates", "qty": 10.0, "uom": "Pkt", "up": 10.0}, {"code": "", "desc": "Trash Bag 50Gal X 10Rap", "qty": 50.0, "uom": "Pkt", "up": 4.9}, {"code": "", "desc": "Cartridge For Hp Laser Printer/Scanner Model Mfp 137Fnw", "qty": 10.0, "uom": "Pcs", "up": 235.0}, {"code": "", "desc": "Gloves: Double Sided Dotted Gloves", "qty": 10000.0, "uom": "Pair", "up": 0.9}, {"code": "", "desc": "100% Pure Cotton Rags  (Bndl)", "qty": 200.0, "uom": "Bundle", "up": 65.0}, {"code": "", "desc": "3M Scotch Mount Clear Double Sided Tape", "qty": 10.0, "uom": "Pcs", "up": 19.0}, {"code": "", "desc": "Drinking Water- 500Ml Bottle (24Pcs/Box)", "qty": 50.0, "uom": "Box", "up": 25.0}, {"code": "", "desc": "Nylon Woven Wrapping Rope 6Mm", "qty": 200.0, "uom": "Pcs", "up": 23.0}, {"code": "", "desc": "Extension Cable 5 Way X 5 Meter", "qty": 50.0, "uom": "Pcs", "up": 79.0}, {"code": "", "desc": "Super Deal Hb Pencil With Eraser", "qty": 50.0, "uom": "Pcs", "up": 3.0}, {"code": "", "desc": "Soft Broom Cleaning Brush With Handle", "qty": 100.0, "uom": "Pcs", "up": 13.0}, {"code": "", "desc": "Yale Medium Brass Pad Lock 60/70Mm", "qty": 50.0, "uom": "Pcs", "up": 67.0}, {"code": "", "desc": "Floor Wiper", "qty": 5.0, "uom": "Pcs", "up": 15.0}, {"code": "", "desc": "Cleaning Mop", "qty": 5.0, "uom": "Pcs", "up": 15.0}, {"code": "", "desc": "Harpic For Toilet Cleaning 495Ml", "qty": 50.0, "uom": "Pcs", "up": 10.0}, {"code": "", "desc": "Toilet Cleaning Brush", "qty": 5.0, "uom": "Pcs", "up": 6.5}, {"code": "", "desc": "Sm Trash Bag 10Gal 4Kg/Pkt", "qty": 50.0, "uom": "Pkt", "up": 5.0}, {"code": "", "desc": "Toilet Tissue Roll (7 Inch Size)300mtr", "qty": 100.0, "uom": "Roll", "up": 11.5}, {"code": "", "desc": "Hand Wash Liquid", "qty": 50.0, "uom": "Pcs", "up": 8.0}, {"code": "", "desc": "Alfa Bright Sponge", "qty": 10.0, "uom": "Pcs", "up": 9.0}, {"code": "", "desc": "Coffe Bean Roasting House Agustino Forest Colombia \n(1 Packet = 907 Grm)", "qty": 10.0, "uom": "Pkt", "up": 210.0}, {"code": "", "desc": "1.5V Alkaline Aa Battery", "qty": 50.0, "uom": "Pcs", "up": 2.0}, {"code": "", "desc": "1.5V Alkaline Aaa Battery", "qty": 50.0, "uom": "Pcs", "up": 2.0}, {"code": "", "desc": "Water Kettle", "qty": 5.0, "uom": "Pcs", "up": 110.0}, {"code": "", "desc": "3Ply Surgical Face Mask (50Pcs/Pkt)", "qty": 2000.0, "uom": "Pkt", "up": 2.75}, {"code": "", "desc": "Nescafe Coffee Farmers Origins", "qty": 200.0, "uom": "Pkt", "up": 23.0}, {"code": "", "desc": "Coffee Powder Baja Mild Roast", "qty": 10.0, "uom": "Pkt", "up": 42.0}, {"code": "", "desc": "Drawer Lock Thailand", "qty": 30.0, "uom": "Pcs", "up": 25.0}, {"code": "", "desc": "Meetion Mouse Pad Pd015", "qty": 5.0, "uom": "Pcs", "up": 13.0}, {"code": "", "desc": "Adaptor 12V, 1.5Amp (For Internet Modem)", "qty": 5.0, "uom": "Pcs", "up": 25.0}, {"code": "", "desc": "Steviana Sweetener 125G", "qty": 20.0, "uom": "Pkt", "up": 18.0}, {"code": "", "desc": "Roco Boardmarker Chisel Tip Red, Blue, Green 12Pcs/Pkt", "qty": 20.0, "uom": "Pkt", "up": 26.0}, {"code": "", "desc": "Portable Conference Speaker S500 Hd Voice", "qty": 3.0, "uom": "Pcs", "up": 990.0}, {"code": "", "desc": "Ethyl Alcohol Spray 500Ml", "qty": 200.0, "uom": "Pcs", "up": 11.0}, {"code": "", "desc": "Adapter Vga To Dvi", "qty": 4.0, "uom": "Pcs", "up": 14.0}], "created": "2026-06-27", "updated": "2026-06-27"}, {"id": "Q-2606-3959", "qno": "Q-2606-3959", "date": "2026-06-25", "company": "AK Investment Company", "contact": "Mr. Faisal", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "AHU Pulley w/Bush SPB 212 / Bush 2517", "qty": 1.0, "uom": "Pcs", "up": 435.0}, {"code": "", "desc": "AHU Pulley w/Bush SPB 180 / Bush 2517", "qty": 1.0, "uom": "Pcs", "up": 390.0}, {"code": "", "desc": "V Belt SPB 1500 – Optibelt", "qty": 6.0, "uom": "Pcs", "up": 56.0}], "created": "2026-06-25", "updated": "2026-06-25"}, {"id": "Q-2606-3958", "qno": "Q-2606-3958", "date": "2026-06-25", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "FIRE BLANKET 1.2MTR X 1.2MTR", "qty": 3.0, "uom": "EA", "up": 32.0}], "created": "2026-06-25", "updated": "2026-06-25"}, {"id": "Q-2606-3957", "qno": "Q-2606-3957", "date": "2026-06-25", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Phoni Power Bank Charger Station 6in1 18W fast charging\n- Portable Battery Pack \n- Built In Cable Lightning USB-C Micro \n- USB Fast Charging Compact, Slim \n- 10000mah \n- Compatible with iPhone Samsung iPad & More (Black)", "qty": 2.0, "uom": "EA", "up": 1215.0}], "created": "2026-06-25", "updated": "2026-06-25"}, {"id": "Q-2606-3956", "qno": "Q-2606-3956", "date": "2026-06-25", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "BEARING, SKF 6201", "qty": 5.0, "uom": "EA", "up": 13.5}], "created": "2026-06-25", "updated": "2026-06-25"}, {"id": "Q-2606-3955", "qno": "Q-2606-3955", "date": "2026-06-24", "company": "GDCME", "contact": "Mr.  Abdulaziz", "city": "7960 Othman Bin Affan, 4108 Al Taawun 12478", "ref": "RFQ-000297-0626", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Brennenstuhl Premium Protect-Line Power Strip FR 6-Way with Coil Protection 60.00 A (3 m Cable, with Off Switch, French Plug System, Made in Germany)", "qty": 14.0, "uom": "EA", "up": 290.0}, {"code": "", "desc": "BAG,PLASTIC PN AA-1799\nNot available", "qty": 25.0, "uom": "BOX", "up": 0}, {"code": "", "desc": "CABLE TIE, 8\" LONG 5MM 100 PER BAG, PN  CV-200 BLACK", "qty": 27.0, "uom": "PG", "up": 16.0}, {"code": "", "desc": "RECORD BOOK, 100SH, SIZE:A5, HARD COVER, 23535BLE", "qty": 50.0, "uom": "EA", "up": 10.0}, {"code": "", "desc": "Pentel MaxiFlo Whiteboard Marker, 1.5 - 3 mm Chisel Tip, Red PEMWL6SB", "qty": 2.0, "uom": "BOX", "up": 9.0}, {"code": "", "desc": "4 X 4 CLOSURE BAG, PLASTIC ZIP LOCK 100EA/PG", "qty": 29.0, "uom": "PG", "up": 75.0}, {"code": "", "desc": "ROCO BOX CUTTER, ASC18MM", "qty": 18.0, "uom": "EA", "up": 13.0}, {"code": "", "desc": "3M Post-it R330 Standard Self Stick Notes Pop Up Fan-pad Refill, Square, 3\" X 3\", 100 Notes/PD, Yellow", "qty": 73.0, "uom": "PD", "up": 8.0}, {"code": "", "desc": "Roco Standard Writing Pad\nA4, 80 Pages (40 Sheets), Lined, White RQ-23011", "qty": 39.0, "uom": "PG", "up": 28.0}, {"code": "", "desc": "LOW LINT CLEANING CLOTH  TOWEL TYPE I PN 3480\nNot available", "qty": 25.0, "uom": "BOX", "up": 0}, {"code": "", "desc": "Magnetic Whiteboard 60 X 40 cm, Silver/White MBA84060", "qty": 7.0, "uom": "EA", "up": 80.0}, {"code": "", "desc": "4M NITRILE GLOVES, BLACK, POWDERFREE, MEDIUM, 100/BOX", "qty": 12.0, "uom": "BOX", "up": 22.0}, {"code": "", "desc": "Roco File Pocket\nSingle Pocket, Topload Opening, A4, Plastic RQ-28073 100Pcs/BOX", "qty": 39.0, "uom": "BOX", "up": 26.0}, {"code": "", "desc": "STAR 8OZ COFFEE CUP 1000Pcs/BOX", "qty": 21.0, "uom": "BOX", "up": 135.0}, {"code": "", "desc": "TAPE, CLEAR PACKING, 3 PACK, PN 791101089345", "qty": 29.0, "uom": "PG", "up": 24.0}], "created": "2026-06-24", "updated": "2026-06-24"}, {"id": "Q-2606-3954", "qno": "Q-2606-3954", "date": "2026-06-24", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "BATTERY, 9V ENERGIZER", "qty": 48.0, "uom": "EA", "up": 18.0}, {"code": "", "desc": "BRUSH, PAINT 4\"", "qty": 40.0, "uom": "EA", "up": 5.0}, {"code": "", "desc": "BRUSH, PAINT 2\"", "qty": 24.0, "uom": "EA", "up": 4.25}, {"code": "", "desc": "BLADE, HACKSAW DOUBLE SIDED", "qty": 6.0, "uom": "EA", "up": 1.5}, {"code": "", "desc": "CAPACITOR, 20UF / 450V\nSee the sample picture for approval", "qty": 10.0, "uom": "EA", "up": 34.0}], "created": "2026-06-24", "updated": "2026-06-24"}, {"id": "Q-2606-3953", "qno": "Q-2606-3953", "date": "2026-06-24", "company": "SD Middle East LLC", "contact": "Mr. Afsal", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "T-Shirt with embroidery, Full sleeve and pocket type.", "qty": 9.0, "uom": "EA", "up": 97.0}, {"code": "", "desc": "Pant with hi-vis", "qty": 9.0, "uom": "EA", "up": 80.0}], "created": "2026-06-24", "updated": "2026-06-24"}, {"id": "Q-2606-3952", "qno": "Q-2606-3952", "date": "2026-06-24", "company": "SD Middle East LLC", "contact": "Mrs. Bhavana", "city": "Jeddah, KSA", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Safety shoes Masters MTB\nDatasheet attached", "qty": 23.0, "uom": "Pair", "up": 125.0}, {"code": "", "desc": "Steel Toe Non Slip Work Boot X2000\nDatasheet attached", "qty": 23.0, "uom": "Pair", "up": 195.0}, {"code": "", "desc": "LIGERO Lightweight ESD Safety Shoes SJ-3FIT\nDatasheet attached", "qty": 23.0, "uom": "Pair", "up": 315.0}], "created": "2026-06-24", "updated": "2026-06-24"}, {"id": "Q-2606-3951", "qno": "Q-2606-3951", "date": "2026-06-24", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "TILES, CEILING WHITE 60X60CM USG OLPSR665", "qty": 50.0, "uom": "EA", "up": 14.0}], "created": "2026-06-24", "updated": "2026-06-24"}, {"id": "Q-2606-3950", "qno": "Q-2606-3950", "date": "2026-06-24", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "ELBOW, PVC 1-1/2\" 45 DEGREE APLACO", "qty": 20.0, "uom": "EA", "up": 10.65}], "created": "2026-06-24", "updated": "2026-06-24"}, {"id": "Q-2606-3949", "qno": "Q-2606-3949", "date": "2026-06-24", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "BELDEN CABLE 5506FE 8CX22AWG SHIELDED\nGREY-NET", "qty": 5.0, "uom": "EA", "up": 2195.0}, {"code": "", "desc": "BELDEN CABLE 5300FE 2CX18AWG SHIELDED STRAND\nGREY-MEX", "qty": 5.0, "uom": "EA", "up": 920.0}], "created": "2026-06-24", "updated": "2026-06-24"}, {"id": "Q-2606-3948", "qno": "Q-2606-3948", "date": "2026-06-24", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "BELDEN 9842 CONTROL CABLE SHLD.BRD. 2PX24AWG\n0113027159F, GREY-NET", "qty": 2.0, "uom": "EA", "up": 4150.0}], "created": "2026-06-24", "updated": "2026-06-24"}, {"id": "Q-2606-3947", "qno": "Q-2606-3947", "date": "2026-06-23", "company": "ARNON PLASTIC COMPANY", "contact": "Mr.  Anzil", "city": "Riyadh,", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Project: Cooler Installation and Partition Work in Compressor Room.", "qty": 1.0, "uom": "Lot", "up": 32000.0}], "created": "2026-06-23", "updated": "2026-06-23"}, {"id": "Q-2606-3946", "qno": "Q-2606-3946", "date": "2026-06-23", "company": "ARNON PLASTIC COMPANY", "contact": "Mr.  Anzil", "city": "Riyadh,", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Project: Gates Maintenance Work at Two Areas", "qty": 1.0, "uom": "Lot", "up": 9300.0}], "created": "2026-06-23", "updated": "2026-06-23"}, {"id": "Q-2606-3945", "qno": "Q-2606-3945", "date": "2026-06-23", "company": "ARNON PLASTIC COMPANY", "contact": "Mr.  Anzil", "city": "Riyadh,", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Project: Flooring Work at PE Warehouse", "qty": 1.0, "uom": "Lot", "up": 12270.0}], "created": "2026-06-23", "updated": "2026-06-23"}, {"id": "Q-2606-3944", "qno": "Q-2606-3944", "date": "2026-06-23", "company": "SD Middle East LLC", "contact": "Mr. Afsal", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Safety sticker 41.5 X 15.5cm", "qty": 20.0, "uom": "EA", "up": 32.0}], "created": "2026-06-23", "updated": "2026-06-23"}, {"id": "Q-2606-3943", "qno": "Q-2606-3943", "date": "2026-06-23", "company": "GDCME", "contact": "Mr.  Abdulaziz", "city": "7960 Othman Bin Affan, 4108 Al Taawun 12478", "ref": "RFQ-000298-0626", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "COLOR RIBBON KIT, YMCKT, 500 PRINTS\nDatacard PN: 534000-003 YMCKT", "qty": 3.0, "uom": "EA", "up": 1580.0}, {"code": "", "desc": "WRAP, BUBBLE 75CM", "qty": 10.0, "uom": "BD", "up": 55.0}, {"code": "", "desc": "TOWEL PAPER TECH-WIPES HORIZON 15.25 X 16.75 3 PLY TISSUE \n1709/7052 90 sheets", "qty": 34.0, "uom": "EA", "up": 165.0}, {"code": "", "desc": "TONER, CARTRIDGE, 415A, CYAN, HP, LASERJET, W2031A", "qty": 25.0, "uom": "EA", "up": 525.0}], "created": "2026-06-23", "updated": "2026-06-23"}, {"id": "Q-2606-3942", "qno": "Q-2606-3942", "date": "2026-06-22", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "DRIVE RELAYS, 24V 12A 41.31.9.024.0010", "qty": 4.0, "uom": "EA", "up": 85.0}], "created": "2026-06-22", "updated": "2026-06-22"}, {"id": "Q-2606-3940", "qno": "Q-2606-3940", "date": "2026-06-22", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "BATTERY 12V 18AH LECXO LX18-12 \nSee the attached datasheet for approval", "qty": 8.0, "uom": "EA", "up": 127.0}], "created": "2026-06-22", "updated": "2026-06-22"}, {"id": "Q-2606-3939", "qno": "Q-2606-3939", "date": "2026-06-22", "company": "MOHG", "contact": "Meshal", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Vetonit Ceramic Tile Fix (White) Brand: Saveta", "qty": 20.0, "uom": "Unit", "up": 31.5}], "created": "2026-06-22", "updated": "2026-06-22"}, {"id": "Q-2606-3938", "qno": "Q-2606-3938", "date": "2026-06-22", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "BLOWER,SIZE:146MM DIAX232MM LG,397410040", "qty": 4.0, "uom": "EA", "up": 210.0}, {"code": "", "desc": "MOTOR,1PH 7455KVA-A31U 1.16A 1550RPM 220", "qty": 4.0, "uom": "EA", "up": 500.0}, {"code": "", "desc": "MOTOR, INTEGRAL - ZAMIL AC (80054689)", "qty": 3.0, "uom": "EA", "up": 725.0}], "created": "2026-06-22", "updated": "2026-06-22"}, {"id": "Q-2606-3937", "qno": "Q-2606-3937", "date": "2026-06-22", "company": "SD Middle East LLC", "contact": "Ms. Anna", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "A3 Size Lamination Pouch Film 100pcs/box", "qty": 2.0, "uom": "BOX", "up": 72.0}, {"code": "", "desc": "A4 Size Lamination Pouch Film 100pcs/box", "qty": 2.0, "uom": "BOX", "up": 41.0}, {"code": "", "desc": "3M H-701R Hard Hat, White 4-Point Ratchet Suspension", "qty": 30.0, "uom": "EA", "up": 47.0}, {"code": "", "desc": "3M H-704R Hard Hat, Green 4-Point Ratchet Suspension", "qty": 6.0, "uom": "EA", "up": 49.0}, {"code": "", "desc": "3M 8210 N95 Particulate Respirator Dust Mask (Pack of 20)", "qty": 10.0, "uom": "BOX", "up": 49.0}, {"code": "", "desc": "3M 1110 Foam Earplugs Corded ( Pack of 100 pairs)", "qty": 2.0, "uom": "Pack", "up": 79.0}, {"code": "", "desc": "3M™ Virtua™ AP Protective Eyewear 11819-Clear Hard Coat Lens \n20pcs/box", "qty": 10.0, "uom": "BOX", "up": 195.0}, {"code": "", "desc": "3M™ Virtua™ AP Protective Eyewear 11815-Gray Hard Coat Lens\nGoggle Safety Dark 11815 3M 20pcs/box", "qty": 3.0, "uom": "BOX", "up": 198.0}, {"code": "", "desc": "Safety Vest Yellow Pocket 3MYPXL - Hi-Tex", "qty": 50.0, "uom": "EA", "up": 20.0}, {"code": "", "desc": "Safety Vest Orange Pocket XL - Hi-Tex", "qty": 500.0, "uom": "EA", "up": 19.0}, {"code": "", "desc": "Anti Cut Gloves Cut Pro 5- L/9\" AGHL Hi-Tex", "qty": 1000.0, "uom": "EA", "up": 7.25}, {"code": "", "desc": "HOT WORKS PPE  ( Fire Blankets, Welding face shield, Welding leather apron, Leather Gloves, Transparent faceshield)", "qty": 2.0, "uom": "EA", "up": 92.0}, {"code": "", "desc": "Safety Harness Full Body With Twin Lanyard MA32 Masters", "qty": 10.0, "uom": "EA", "up": 75.0}, {"code": "", "desc": "Safety Barrier 1M 7KG 1*1M", "qty": 100.0, "uom": "EA", "up": 44.0}, {"code": "", "desc": "Plastic Chain Red & White 8MM* 25 M", "qty": 10.0, "uom": "EA", "up": 49.0}, {"code": "", "desc": "Flag Man Dummy", "qty": 12.0, "uom": "Set", "up": 125.0}, {"code": "", "desc": "Vanderlande Logo Vinyl sticker 50mm x 10mm", "qty": 200.0, "uom": "EA", "up": 1.0}, {"code": "", "desc": "HSE Inducted Vinyl Sticker 60 MM Dia", "qty": 200.0, "uom": "EA", "up": 1.25}, {"code": "", "desc": "Permit to work Vinyl Sticker 60 MM Dia", "qty": 200.0, "uom": "EA", "up": 1.25}, {"code": "", "desc": "Chin Strap CSH Hi-Tex", "qty": 100.0, "uom": "EA", "up": 1.5}, {"code": "", "desc": "Dust Bin 120L", "qty": 9.0, "uom": "EA", "up": 120.0}, {"code": "", "desc": "Dust Bin 120L", "qty": 9.0, "uom": "EA", "up": 120.0}, {"code": "", "desc": "Dust Bin 120L", "qty": 3.0, "uom": "EA", "up": 120.0}, {"code": "", "desc": "Water Cooler 10 Gallon", "qty": 4.0, "uom": "EA", "up": 97.0}], "created": "2026-06-22", "updated": "2026-06-22"}, {"id": "Q-2606-3936", "qno": "Q-2606-3936", "date": "2026-06-21", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "BATTERY, GENERATOR, CMF120L 120AH 12V MADE IN KOREA\nSee the attached sample picture for your approval", "qty": 2.0, "uom": "EA", "up": 575.0}], "created": "2026-06-21", "updated": "2026-06-21"}, {"id": "Q-2606-3935", "qno": "Q-2606-3935", "date": "2026-06-21", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "RELAY, 12VDC,RXM4AB1JD,SCHNEIDER", "qty": 15.0, "uom": "EA", "up": 22.5}, {"code": "", "desc": "RELAY BASE, RXZE2M114M,SCHNEIDER", "qty": 15.0, "uom": "EA", "up": 13.0}], "created": "2026-06-21", "updated": "2026-06-21"}, {"id": "Q-2606-3934", "qno": "Q-2606-3934", "date": "2026-06-21", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "BATTERY, AA DURACELL", "qty": 200.0, "uom": "EA", "up": 1.9499999999999997}, {"code": "", "desc": "FIRE EXTINGUISHERS SAFETY PULL TIE SEAL", "qty": 50.0, "uom": "EA", "up": 2.0}, {"code": "", "desc": "TERMINAL CONNECTOR 2.5MM 800V TC2.5/880V\nSee the attached sample picture for your approval", "qty": 3.0, "uom": "EA", "up": 3.0}, {"code": "", "desc": "TERMINAL CONNECTOR 10MM 800V TC-10/880V\nSee the attached sample picture for your approval", "qty": 3.0, "uom": "EA", "up": 3.9}, {"code": "", "desc": "SEAL,ELECTRICAL DUCT COMPOUND SEAL3000\nPlease provide sample picture", "qty": 5.0, "uom": "EA", "up": 0}, {"code": "", "desc": "CABLE TIE BASE19X19 KSS-HC-101 White", "qty": 4.0, "uom": "BAG", "up": 46.0}, {"code": "", "desc": "CABLE, TIE 8MM X 450MM KSS-CV-450\n9MM X 425MM is not available", "qty": 20.0, "uom": "BAG", "up": 42.0}, {"code": "", "desc": "TAPE, ALUMINIUM 2\"", "qty": 6.0, "uom": "EA", "up": 43.0}], "created": "2026-06-21", "updated": "2026-06-21"}, {"id": "Q-2606-3933", "qno": "Q-2606-3933", "date": "2026-06-21", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "PAINT, ROLLER 4\"", "qty": 25.0, "uom": "EA", "up": 5.75}], "created": "2026-06-21", "updated": "2026-06-21"}, {"id": "Q-2606-3932", "qno": "Q-2606-3932", "date": "2026-06-20", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Won", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "AKADA D3000\n[EN 12 Heavy duty Tandem/twin door closer for Heavy door, weight up to 300Kg (<1400MM) and 500Kg (<1000MM) doors, EN 12 Powered Twin Hydraulic cylinders for closing the door]\n\nPart Number-D3000\nFree delivery 70 Days After receiving PO.", "qty": 4.0, "uom": "EA", "up": 1945.0}, {"code": "", "desc": "Air freight charge. (for delivery within 10 days after receiving PO.)", "qty": 1.0, "uom": "EA", "up": 2450.0}], "created": "2026-06-20", "updated": "2026-06-20"}, {"id": "Q-2606-3931", "qno": "Q-2606-3931", "date": "2026-06-20", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "PAINT,JOTAFLOOR TC E BASE 7.2L,RAL-6084 - JOTUN", "qty": 1.0, "uom": "EA", "up": 775.0}, {"code": "", "desc": "PAINT,FENOMASTIC PURE COLOR, RAL-8282 - JOTUN\nINTERIOR", "qty": 1.0, "uom": "EA", "up": 385.0}, {"code": "", "desc": "PAINT,FENOMASTIC PURE COLOR, RAL-9913 - JOTUN\nINTERIOR", "qty": 1.0, "uom": "EA", "up": 415.0}], "created": "2026-06-20", "updated": "2026-06-20"}, {"id": "Q-2606-3930", "qno": "Q-2606-3930", "date": "2026-06-24", "company": "ARNON PLASTIC COMPANY", "contact": "Mr.  Anzil", "city": "Riyadh,", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Supply and installation of cable.\n[From Bandera to Chiller Area]\nBrand: Riyadh Cable\nCore: 4\nSize: 70MM\nType: XLPE", "qty": 45.0, "uom": "MTR", "up": 222.0}], "created": "2026-06-24", "updated": "2026-06-24"}, {"id": "Q-2606-3929", "qno": "Q-2606-3929", "date": "2026-06-18", "company": "MOHG", "contact": "Amal", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Raghdan NC Gloss Paint 20001 Black 9000  4 Ltr.", "qty": 20.0, "uom": "Pcs", "up": 85.0}], "created": "2026-06-18", "updated": "2026-06-18"}, {"id": "Q-2606-3928", "qno": "Q-2606-3928", "date": "2026-06-18", "company": "ARNON PLASTIC COMPANY", "contact": "Mr.  Anzil", "city": "Riyadh,", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Supply and installation New Fire Door", "qty": 1, "uom": "Pcs", "up": 0}], "created": "2026-06-18", "updated": "2026-06-18"}, {"id": "Q-2606-3927", "qno": "Q-2606-3927", "date": "2026-06-18", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "SOLENOID VALVE BODY UL-EVR32-042H1176", "qty": 2.0, "uom": "EA", "up": 2490.0}, {"code": "", "desc": "CIRCUIT BREAKER,S201-K06,ABB", "qty": 2.0, "uom": "EA", "up": 415.0}, {"code": "", "desc": "CIRCUIT BREAKER,XT5N 400 TMA 400,ABB", "qty": 2.0, "uom": "EA", "up": 10950.0}, {"code": "", "desc": "DANFOSS 018F4123,SOLENOID COIL BX SERIES", "qty": 6.0, "uom": "EA", "up": 650.0}, {"code": "", "desc": "CONTACTOR,AF16-30-10-13 100-250V", "qty": 8.0, "uom": "EA", "up": 650.0}, {"code": "", "desc": "CONTACTOR,AF12-30-10-13 100-250V", "qty": 8.0, "uom": "EA", "up": 545.0}, {"code": "", "desc": "CONTACTOR,AF146-30-22-12#48-130V", "qty": 2.0, "uom": "EA", "up": 2950.0}, {"code": "", "desc": "LOW PRESSURE GAUGE,2.5\", 1/4\"", "qty": 2.0, "uom": "EA", "up": 490.0}, {"code": "", "desc": "OVERLOAD RELAY,TA200DU-110 THERMAL", "qty": 8.0, "uom": "EA", "up": 1150.0}, {"code": "", "desc": "SIGHT-GLASS UL DANFOSS-SGN+10S", "qty": 2.0, "uom": "EA", "up": 300.0}, {"code": "", "desc": "ISOLATOR POWER SWITCH,OT630E03", "qty": 2.0, "uom": "EA", "up": 4150.0}, {"code": "", "desc": "SOLENOID VALVE BODY UL-EVR 10-032032L12", "qty": 2.0, "uom": "EA", "up": 775.0}, {"code": "", "desc": "SOLENOID VALVE BODY UL-EVR 10-032032L12", "qty": 2.0, "uom": "EA", "up": 775.0}, {"code": "", "desc": "HIGH PRESSURE GAUGE,2.5\",1/4\"", "qty": 2.0, "uom": "EA", "up": 485.0}], "created": "2026-06-18", "updated": "2026-06-18"}, {"id": "Q-2606-3926", "qno": "Q-2606-3926", "date": "2026-06-17", "company": "ARNON PLASTIC COMPANY", "contact": "Mr.  Anzil", "city": "Riyadh,", "ref": "", "status": "Won", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Project: Ceiling Channel Repair and installation of Ceiling Tiles 60 x 60 at Bandera 1 & 2", "qty": 1.0, "uom": "Lot", "up": 23500.0}], "created": "2026-06-17", "updated": "2026-06-17"}, {"id": "Q-2606-3925", "qno": "Q-2606-3925", "date": "2026-06-17", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "SOCKET, 13A DP 1 GANG SWITCHED SOCKET K2977ALM, TWIN EARTH METAL CLAD GREY COLORSWITCH, CONN UNIT W/NEON 13A 1G DP-2977", "qty": 10.0, "uom": "EA", "up": 55.0}, {"code": "", "desc": "Marshall-Tufflex MINI- SELF ADHESIVE TRUNKING MMT2 25 x 16mm", "qty": 5.0, "uom": "EA", "up": 37.0}], "created": "2026-06-17", "updated": "2026-06-17"}, {"id": "Q-2606-3924", "qno": "Q-2606-3924", "date": "2026-06-17", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "BELT, FAN - AX-31 Gates USA Alternative\nMITSUBOSHI Brand Not available", "qty": 8.0, "uom": "EA", "up": 36.0}, {"code": "", "desc": "FAUCET, HAND SPRAY W/HOSE 1/2\" NIAGARA ORIGINAL N2320-TP", "qty": 40.0, "uom": "EA", "up": 135.0}, {"code": "", "desc": "TAPE, DOUBLE SIDE 1\"", "qty": 20.0, "uom": "EA", "up": 7.5}, {"code": "", "desc": "TAPE,PERMANENT DOUBL SIDE 1/2\" 3M SCOTCH", "qty": 10.0, "uom": "EA", "up": 21.0}, {"code": "", "desc": "GREASE, MULTI PURPOSE SKF LMGT 3/1 (1KG)", "qty": 5.0, "uom": "EA", "up": 48.75}, {"code": "", "desc": "RUST, REMOVER (WD-40)", "qty": 48.0, "uom": "EA", "up": 17.5}, {"code": "", "desc": "TAPE, INSULATING 3M BLACK 20M x 19MM", "qty": 50.0, "uom": "EA", "up": 3.25}, {"code": "", "desc": "CLEANER, ELECTRO CONTACT (CRC)", "qty": 24.0, "uom": "EA", "up": 44.0}], "created": "2026-06-17", "updated": "2026-06-17"}, {"id": "Q-2606-3923", "qno": "Q-2606-3923", "date": "2026-06-17", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "BATTERY, 12V-70AH- NX110-5LMF-ACDELCO", "qty": 4.0, "uom": "EA", "up": 465.0}], "created": "2026-06-17", "updated": "2026-06-17"}, {"id": "Q-2606-3922", "qno": "Q-2606-3922", "date": "2026-06-16", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "G.I. Threaded Road 12 mm", "qty": 4.0, "uom": "EA", "up": 13.0}, {"code": "", "desc": "GMI RED.TEE 1-1/4x1\" THRD", "qty": 6.0, "uom": "EA", "up": 16.5}, {"code": "", "desc": "GMI RED.COUPLING 1x1/2\" FEMALE THRD", "qty": 6.0, "uom": "EA", "up": 10.5}, {"code": "", "desc": "GMI RED COUPLING 1-1/4x1\" FEMALE THRD", "qty": 6.0, "uom": "EA", "up": 14.0}, {"code": "", "desc": "Pipe Nipple 1\" -  8\" length", "qty": 4.0, "uom": "EA", "up": 28.0}, {"code": "", "desc": "Pipe Nipple 1\" -  6\" length", "qty": 4.0, "uom": "EA", "up": 26.0}, {"code": "", "desc": "Pipe Nipple 1\" -  4\" length", "qty": 4.0, "uom": "EA", "up": 25.0}, {"code": "", "desc": "Pipe Nipple 1-1/4\" -  8\" length", "qty": 4.0, "uom": "EA", "up": 28.0}, {"code": "", "desc": "Pipe Nipple 1-1/4\" -  6\" length", "qty": 4.0, "uom": "EA", "up": 27.0}, {"code": "", "desc": "Pipe Nipple 1-1/4\" -  10\" length", "qty": 4.0, "uom": "EA", "up": 29.75}, {"code": "", "desc": "GTC PIPE 1\" SCH-40-6 MTR JAZEERA", "qty": 4.0, "uom": "LTH", "up": 109.00000000000001}, {"code": "", "desc": "GTC PIPE 1-1/4\" SCH-40 6 MTR JAZEERA", "qty": 4.0, "uom": "LTH", "up": 160.0}, {"code": "", "desc": "Permatex brown", "qty": 2.0, "uom": "EA", "up": 34.0}, {"code": "", "desc": "GROOVED MECH.TEE 4x1-1/4\" (G&T) UL FM", "qty": 3.0, "uom": "EA", "up": 29.0}, {"code": "", "desc": "MECH-GROOVED MECH.TEE 2x1-1/4\" (G&T) UL FM", "qty": 3.0, "uom": "EA", "up": 28.0}, {"code": "", "desc": "Hanging Clamp 1\" x 1-1/4\"", "qty": 8.0, "uom": "EA", "up": 5.5}, {"code": "", "desc": "DROP IN ANCHOR 12MM", "qty": 14.0, "uom": "EA", "up": 2.5}, {"code": "", "desc": "GMI ELBOW 90° 1-1/4\" THRD", "qty": 12.0, "uom": "EA", "up": 9.75}, {"code": "", "desc": "GMI RED.ELBOW 90° 1x1/2\"  THRD", "qty": 10.0, "uom": "EA", "up": 8.0}, {"code": "", "desc": "GMI ELBOW 90° 1-1/4\" x 1\" THRD", "qty": 5.0, "uom": "EA", "up": 17.0}, {"code": "", "desc": "HSS DRILL INDIA IT 12mm", "qty": 4.0, "uom": "EA", "up": 24.0}, {"code": "", "desc": "Gypsum Board, 12 mm fire rated", "qty": 20.0, "uom": "EA", "up": 33.0}, {"code": "", "desc": "C-Channel, 3\"", "qty": 50.0, "uom": "EA", "up": 14.0}, {"code": "", "desc": "C-Channel, 1. 1/2\"", "qty": 25.0, "uom": "EA", "up": 6.0}, {"code": "", "desc": "S/D SCREW WAFER Z.P.8×1/2", "qty": 1.0, "uom": "BOX", "up": 28.0}, {"code": "", "desc": "S/D SCREW WAFER ZP8×1.1/2", "qty": 1.0, "uom": "BOX", "up": 43.0}, {"code": "", "desc": "PLASTIC DAR GRAY 6mm", "qty": 4.0, "uom": "BOX", "up": 8.0}, {"code": "", "desc": "DRYWALL CS BLK 7×1.1/2", "qty": 1.0, "uom": "BOX", "up": 34.0}, {"code": "", "desc": "HSS DRILL INDIA IT 6mm 10pcs/BOX", "qty": 1.0, "uom": "BOX", "up": 70.0}, {"code": "", "desc": "HSS DRILL INDIA IT 5mm 10pcs/BOX", "qty": 1.0, "uom": "BOX", "up": 55.0}, {"code": "", "desc": "HSS DRILL INDIA IT 4mm 10pcs/BOX", "qty": 1.0, "uom": "BOX", "up": 35.0}, {"code": "", "desc": "Concrete Drill Bits, 6 mm", "qty": 5.0, "uom": "EA", "up": 25.0}, {"code": "", "desc": "Delivery Charges", "qty": 1.0, "uom": "EA", "up": 250.0}], "created": "2026-06-16", "updated": "2026-06-16"}, {"id": "Q-2606-3921", "qno": "Q-2606-3921", "date": "2026-06-16", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "PAINT,TOPCOAT 55210 11480 GREY (HEMPEL)", "qty": 3.0, "uom": "EA", "up": 995.0}], "created": "2026-06-16", "updated": "2026-06-16"}, {"id": "Q-2606-3920", "qno": "Q-2606-3920", "date": "2026-06-15", "company": "ARNON PLASTIC COMPANY", "contact": "Mr.  Anzil", "city": "Riyadh,", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Project: Partition Work and Desert Cooler Supply & Installation at outside Bandera 2", "qty": 1.0, "uom": "Lot", "up": 26900.0}], "created": "2026-06-15", "updated": "2026-06-15"}, {"id": "Q-2606-3919", "qno": "Q-2606-3919", "date": "2026-06-15", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "BATTERY, LITHIUM BTU LS 17500 3.6V", "qty": 30.0, "uom": "EA", "up": 81.5}, {"code": "", "desc": "BULB, LED PHILIPS-DIM LIGT-9.5W-220V-E27\nPlease provide sample picture", "qty": 20.0, "uom": "EA", "up": 0}], "created": "2026-06-15", "updated": "2026-06-15"}, {"id": "Q-2606-3918", "qno": "Q-2606-3918", "date": "2026-06-15", "company": "SD Middle East LLC", "contact": "Mr. Afsal", "city": "Riyadh", "ref": "", "status": "Won", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "BESANTEK, BST-TKM05", "qty": 1.0, "uom": "EA", "up": 1750.0}], "created": "2026-06-15", "updated": "2026-06-15"}, {"id": "Q-2606-3917", "qno": "Q-2606-3917", "date": "2026-06-11", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "BATTERY,3V,CR-2032", "qty": 10.0, "uom": "EA", "up": 2.5}, {"code": "", "desc": "LOCTITE 401,SUPER GLUE", "qty": 5.0, "uom": "EA", "up": 38.0}, {"code": "", "desc": "PVC ELBOW 45° 3/4\" GREY SCH-80", "qty": 10.0, "uom": "EA", "up": 3.5}, {"code": "", "desc": "CABLE,TIE NYLON 200 X 3.6MM BLACK", "qty": 50.0, "uom": "EA", "up": 6.75}, {"code": "", "desc": "CPVC UNION 3/4\" GREY APLACO", "qty": 10.0, "uom": "EA", "up": 16.0}, {"code": "", "desc": "CPVC FEMALE ADAPTER 1/2\" BRASS INSERT", "qty": 6.0, "uom": "EA", "up": 8.25}, {"code": "", "desc": "CPVC FEMALE ADAPTER 3/4\"x1/2\" BRASS INSERT", "qty": 10.0, "uom": "EA", "up": 9.5}], "created": "2026-06-11", "updated": "2026-06-11"}, {"id": "Q-2606-3916", "qno": "Q-2606-3916", "date": "2026-06-11", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "PAINT, SPRAY WHITE ABRO", "qty": 6.0, "uom": "EA", "up": 8.5}, {"code": "", "desc": "PAINT, SPRAY GRAY ABRO", "qty": 12.0, "uom": "EA", "up": 8.5}, {"code": "", "desc": "TAPE, DUCT 3\" WHITE FOR PIPE INSULATION", "qty": 5.0, "uom": "EA", "up": 45.0}], "created": "2026-06-11", "updated": "2026-06-11"}, {"id": "Q-2606-3914", "qno": "Q-2606-3914", "date": "2026-06-11", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "RUST, REMOVER (WD-40)", "qty": 144.0, "uom": "EA", "up": 17.75}, {"code": "", "desc": "SEALANT, SILICONE CLEAR/TRANSPARENT – GP Brand", "qty": 50.0, "uom": "EA", "up": 11.0}, {"code": "", "desc": "SEALANT, SILICONE WHITE GP Brand", "qty": 50.0, "uom": "EA", "up": 11.0}, {"code": "", "desc": "WIPER, FLOOR 75CM – TTS ITALY\nOut of Stock", "qty": 10.0, "uom": "EA", "up": 0}, {"code": "", "desc": "WIPER, 45CM BIG TTS ITALY", "qty": 10.0, "uom": "EA", "up": 82.0}, {"code": "", "desc": "WIPER, BIG 55CMS WITH HANDLETTS ITALY", "qty": 10.0, "uom": "EA", "up": 88.0}, {"code": "", "desc": "BLADE, KNIFE TACTIX UTILITY 5PC", "qty": 5.0, "uom": "EA", "up": 18.0}, {"code": "", "desc": "GREASE, MULTI PURPOSE SKF LMGT 3/1 (1KG)", "qty": 20.0, "uom": "EA", "up": 46.5}, {"code": "", "desc": "EXTENSION CABLE REEL,L=50MTRS,BLACK COL", "qty": 2.0, "uom": "EA", "up": 225.0}, {"code": "", "desc": "GREASE, MOBIL POLYREX EM-NLGI #2-16KG/CN", "qty": 5.0, "uom": "CAN", "up": 2850.0}, {"code": "", "desc": "CHEVRON SRI GREASE 2 15.9KG/CAN", "qty": 3.0, "uom": "CAN", "up": 3100.0}, {"code": "", "desc": "GASKET, RUBBER 3MM 10MTR/ROLL", "qty": 2.0, "uom": "ROLL", "up": 315.0}, {"code": "", "desc": "GASKET, RUBBER 2MMX1MTRX1MTR", "qty": 2.0, "uom": "MTR", "up": 29.0}, {"code": "", "desc": "CLEANER, PVC-733,1/2KG", "qty": 4.0, "uom": "EA", "up": 24.0}, {"code": "", "desc": "GLOVES, COTTON WITH GRIP", "qty": 200.0, "uom": "PAIR", "up": 1.25}, {"code": "", "desc": "PACKING 32X7.9 GRAPHITE\nNot Available", "qty": 1.0, "uom": "EA", "up": 0}, {"code": "", "desc": "PAINT, SPRAY YELLOW- ABRO", "qty": 36.0, "uom": "EA", "up": 8.25}, {"code": "", "desc": "PAINT, SPRAY GREEN- ABRO", "qty": 72.0, "uom": "EA", "up": 8.25}, {"code": "", "desc": "PAINT, SPRAY RED- ABRO", "qty": 60.0, "uom": "EA", "up": 8.25}, {"code": "", "desc": "PAINT, SPRAY BLUE- ABRO", "qty": 60.0, "uom": "EA", "up": 8.25}, {"code": "", "desc": "PAINT, SPRAY GRAY- ABRO", "qty": 24.0, "uom": "EA", "up": 8.25}, {"code": "", "desc": "PAINT, SPRAY SILVER (ALUMINIUM)- ABRO", "qty": 28.0, "uom": "EA", "up": 14.0}, {"code": "", "desc": "PAINT, SPRAY BLACK ABRO", "qty": 43.0, "uom": "EA", "up": 8.25}, {"code": "", "desc": "PAINT, SPRAY WHITE ABRO", "qty": 15.0, "uom": "EA", "up": 8.25}, {"code": "", "desc": "PAINT,ENAMEL GRAY,3.75LTR/CAN", "qty": 4.0, "uom": "EA", "up": 265.0}, {"code": "", "desc": "PAINT,MAESTRO GLOSS ENAMEL,YELLOW,3.79L", "qty": 4.0, "uom": "EA", "up": 255.0}, {"code": "", "desc": "PAINT, ENAMEL RED 3.79 Liters", "qty": 6.0, "uom": "EA", "up": 245.0}, {"code": "", "desc": "PAINT, ENAMEL GREEN 3.79 Liters", "qty": 8.0, "uom": "EA", "up": 265.0}, {"code": "", "desc": "PAINT, ENAMEL NAVY BLUE 3.79 Liters", "qty": 6.0, "uom": "EA", "up": 245.0}, {"code": "", "desc": "PAINT,TOPCOAT 55210 11480 GREY (HEMPEL)", "qty": 10.0, "uom": "EA", "up": 994.9999999999999}, {"code": "", "desc": "Hempel's WB Airfield & Road Marking 28101 Yellow\n[YELLOW 569ME  HEMPEL -  Item not Available]", "qty": 3.0, "uom": "CAN", "up": 675.0}, {"code": "", "desc": "Hempel's WB Airfield & Road Marking 28101 White\n[WHITE HEMPEL 569ME - Item not Available]", "qty": 3.0, "uom": "CAN", "up": 525.0}, {"code": "", "desc": "Hempel's WB Airfield & Road Marking 28101 Black\n[BLACK HEMPEL 569ME - Item not Available]", "qty": 2.0, "uom": "CAN", "up": 615.0}, {"code": "", "desc": "PAINT, ACRYLIC ROYAL (0500-N),18L/CAN", "qty": 6.0, "uom": "CAN", "up": 225.0}, {"code": "", "desc": "TAPE, MASKING 2\" ABRO", "qty": 25.0, "uom": "BOX", "up": 67.5}], "created": "2026-06-11", "updated": "2026-06-11"}, {"id": "Q-2606-3913", "qno": "Q-2606-3913", "date": "2026-06-09", "company": "Al Hammadi", "contact": "Mr. Abdulaziz", "city": "Riyadh", "ref": "MR-30131", "status": "Draft", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "CONTAINER BLUE BIN PLASTIC SIZE #2 \\\"ARCOMA\\\"", "qty": 6.0, "uom": "EA", "up": 8.0}, {"code": "", "desc": "CONTAINER BLUE BIN PLASTIC SIZE #4 \\\"ARCOMA\\\"", "qty": 2.0, "uom": "EA", "up": 22.0}, {"code": "", "desc": "CONTAINER BLUE BIN PLASTIC SIZE #5 \\\"ARCOMA\\\"", "qty": 4.0, "uom": "EA", "up": 23.0}], "created": "2026-06-09", "updated": "2026-06-09"}, {"id": "Q-2606-3911", "qno": "Q-2606-3911", "date": "2026-06-08", "company": "GDCME", "contact": "Mr. Jean Lopez", "city": "7960 Othman Bin Affan, 4108 Al Taawun 12478", "ref": "RFQ-000288-0626", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "PAPER WHITE SIZE: A4 80G 500SH / RM PN A4 RQ-C801A45H\n5RM/BOX", "qty": 120.0, "uom": "BOX", "up": 79.5}], "created": "2026-06-08", "updated": "2026-06-08"}, {"id": "Q-2606-3910", "qno": "Q-2606-3910", "date": "2026-06-07", "company": "ARNON PLASTIC COMPANY", "contact": "Mr.  Anzil", "city": "Riyadh,", "ref": "", "status": "Lost", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Project: Racks Dismantling Work at Raw Materials Warehouse", "qty": 1.0, "uom": "Lot", "up": 8000.0}], "created": "2026-06-07", "updated": "2026-06-07"}, {"id": "Q-2606-3909", "qno": "Q-2606-3909", "date": "2026-06-07", "company": "Edarat Group", "contact": "Mr. Nabhan", "city": "Riyadh", "ref": "", "status": "Won", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Waste Toner Container for C8145, 008R08101", "qty": 1.0, "uom": "EA", "up": 325.0}], "created": "2026-06-07", "updated": "2026-06-07"}, {"id": "Q-2606-3908", "qno": "Q-2606-3908", "date": "2026-06-23", "company": "Edarat Group", "contact": "Mr. Nabhan", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Samsung Flip Pro WMB Interactive Display, 65\"", "qty": 1.0, "uom": "EA", "up": 8990.0}, {"code": "", "desc": "WA65D 65in Interactive Display LH65WADWLGCXUE\nAlternative Option", "qty": 1.0, "uom": "EA", "up": 6450.0}, {"code": "", "desc": "Poly Trio C60 IP Conference Phone", "qty": 1.0, "uom": "EA", "up": 1550.0}, {"code": "", "desc": "Polycom Trio Visual+ Accessory for the Trio conference phone", "qty": 1.0, "uom": "EA", "up": 460.0}, {"code": "", "desc": "Poly Studio R30 Webcam", "qty": 1.0, "uom": "EA", "up": 3850.0}, {"code": "", "desc": "Logitech MK295", "qty": 1.0, "uom": "EA", "up": 125.0}, {"code": "", "desc": "Mini Desktop Computer 8GB DDR4 256GB SSD, NiPoGi P2, Win 11-Pro Ryzen Embedded R2544", "qty": 1.0, "uom": "EA", "up": 1380.0}, {"code": "", "desc": "HDMI 2.1 cable", "qty": 1.0, "uom": "EA", "up": 69.0}, {"code": "", "desc": "Waste Toner Container for C8145, 008R08101", "qty": 1.0, "uom": "EA", "up": 325.0}], "created": "2026-06-23", "updated": "2026-06-23"}, {"id": "Q-2606-3908", "qno": "Q-2606-3908", "date": "2026-06-07", "company": "Edarat Group", "contact": "Mr. Nabhan", "city": "Riyadh", "ref": "", "status": "Won", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Samsung Flip Pro WMB Interactive Display, 65\"", "qty": 1.0, "uom": "EA", "up": 9350.0}, {"code": "", "desc": "Poly Trio C60 IP Conference Phone", "qty": 1.0, "uom": "EA", "up": 1570.0}, {"code": "", "desc": "Polycom Trio Visual+ Accessory for the Trio conference phone", "qty": 1.0, "uom": "EA", "up": 475.0}, {"code": "", "desc": "Poly Studio R30 Webcam", "qty": 1.0, "uom": "EA", "up": 4350.0}, {"code": "", "desc": "Logitech MK295", "qty": 1.0, "uom": "EA", "up": 125.0}, {"code": "", "desc": "Mini Desktop Computer 8GB DDR4 256GB SSD, NiPoGi P2, Win 11-Pro Ryzen Embedded R2544", "qty": 1.0, "uom": "EA", "up": 1380.0}, {"code": "", "desc": "Samsung 70 inch Crystal UHD, 70 inch, Black UA70DU7000UXSA", "qty": 1.0, "uom": "EA", "up": 2875.0}, {"code": "", "desc": "HDMI 2.1 cable", "qty": 1.0, "uom": "EA", "up": 69.0}], "created": "2026-06-07", "updated": "2026-06-07"}, {"id": "Q-2606-3907", "qno": "Q-2606-3907", "date": "2026-06-04", "company": "MOHG", "contact": "Mr. Ershad", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Bosch PL1632, 3-1/4-Inches Planer", "qty": 1.0, "uom": "Pcs", "up": 755.0}], "created": "2026-06-04", "updated": "2026-06-04"}, {"id": "Q-2606-3906", "qno": "Q-2606-3906", "date": "2026-06-04", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "TUBE LIGHT,F20 TA 18W BLACK", "qty": 25.0, "uom": "EA", "up": 5.949999999999999}, {"code": "", "desc": "FLUROSCENT TUBE HOLDER", "qty": 100.0, "uom": "EA", "up": 2.65}, {"code": "", "desc": "OSRAM DECOSTAR 41870 WFL 12V 50W MR16 GU5.3 GERMANY", "qty": 300.0, "uom": "EA", "up": 3.5}, {"code": "", "desc": "OSRAM DECOSTAR 41892 WFL 35W 12V GU41x10\nOSRAM 44892 Not Available", "qty": 100.0, "uom": "EA", "up": 9.9}, {"code": "", "desc": "TUBE, FLOU FH35W/840 HE COOL WHITE OSRAM", "qty": 50.0, "uom": "EA", "up": 9.75}, {"code": "", "desc": "BULB,35W/830 WDL WARM WHITE,HCI-T", "qty": 30.0, "uom": "EA", "up": 65.0}, {"code": "", "desc": "BULB, OSRAM POWERBALL 70W/942 NDL WHITE", "qty": 25.0, "uom": "BAG", "up": 66.0}, {"code": "", "desc": "POWER BALL, HCI-TC 35W/NDL-G8.6 ,35W/942", "qty": 15.0, "uom": "EA", "up": 66.0}], "created": "2026-06-04", "updated": "2026-06-04"}, {"id": "Q-2606-3905", "qno": "Q-2606-3905", "date": "2026-06-04", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "BALLAST, OSRAM PT-FIT 70/220-240 S", "qty": 20.0, "uom": "EA", "up": 83.0}, {"code": "", "desc": "HAGER TIMER SWITCH CONTROLLER24AC/DC,16A-EH110", "qty": 5.0, "uom": "EA", "up": 176.0}, {"code": "", "desc": "APC BACK UP UPS 750VA,230V-BX-750MI-MS", "qty": 3.0, "uom": "EA", "up": 338.0}, {"code": "", "desc": "CABLE, BELDEN,2C,22 AWG P/N 8761-GREY", "qty": 1.0, "uom": "EA", "up": 990.0}, {"code": "", "desc": "PLUG, ELECTRICAL BLUE 16A 3PIN MALE", "qty": 10.0, "uom": "EA", "up": 19.5}, {"code": "", "desc": "CABLE, 3 CORE 2.5MM,91.40MTR/ROLL", "qty": 3.0, "uom": "EA", "up": 565.0}, {"code": "", "desc": "PLUG,3 PIN 13A MALE,LEGRAND,650013", "qty": 20.0, "uom": "EA", "up": 8.75}], "created": "2026-06-04", "updated": "2026-06-04"}, {"id": "Q-2606-3904", "qno": "Q-2606-3904", "date": "2026-06-04", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Won", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "ALUM FLEXIBLE DUCT PIPE 6\",L=1M", "qty": 2.0, "uom": "EA", "up": 69.0}, {"code": "", "desc": "TAPE, TEFLON 19MMX0.1MMX50M", "qty": 20.0, "uom": "EA", "up": 4.25}, {"code": "", "desc": "TAPE, ALUMINIUM FOIL 3\" DUCT", "qty": 4.0, "uom": "EA", "up": 37.0}, {"code": "", "desc": "TAPE, WARNING RED/WHITE,2\",200MTR", "qty": 20.0, "uom": "EA", "up": 5.95}, {"code": "", "desc": "RUST, REMOVER (WD-40)", "qty": 48.0, "uom": "EA", "up": 17.25}], "created": "2026-06-04", "updated": "2026-06-04"}, {"id": "Q-2606-3903", "qno": "Q-2606-3903", "date": "2026-06-04", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Won", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "PUTTY,WATER RESISTANT,N.C.B,25KG/BAG", "qty": 6.0, "uom": "EA", "up": 42.0}, {"code": "", "desc": "PAINT,WHITE ENAMEL(MATT FINISH)526ME,18L", "qty": 1.0, "uom": "EA", "up": 585.0}], "created": "2026-06-04", "updated": "2026-06-04"}, {"id": "Q-2606-3902", "qno": "Q-2606-3902", "date": "2026-06-04", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "URINAL SCREEN DEODORIZER W/URINAL CAKE", "qty": 24.0, "uom": "EA", "up": 16.5}, {"code": "", "desc": "BAG,GARBAGE 50 GALLON 10 KG BUNDLE", "qty": 25.0, "uom": "BDL", "up": 55.0}, {"code": "", "desc": "DUST PAN WITH METAL HANDLE,TTS ITALY", "qty": 7.0, "uom": "EA", "up": 158.0}, {"code": "", "desc": "PAD, FLOOR STRIPPING BLACK 17\" 3M", "qty": 15.0, "uom": "EA", "up": 29.5}, {"code": "", "desc": "WIPER, BIG 55CMS WITH HANDLE TTS ITALY", "qty": 15.0, "uom": "EA", "up": 83.0}], "created": "2026-06-04", "updated": "2026-06-04"}, {"id": "Q-2606-3901", "qno": "Q-2606-3901", "date": "2026-06-04", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "DOOR, STOPPER ROUND HALF-SS 304", "qty": 24.0, "uom": "EA", "up": 16.0}, {"code": "", "desc": "Hempel's WB Airfield & Road Marking 28101 White\nWHITE HEMPEL 569ME - Item not Available", "qty": 5.0, "uom": "EA", "up": 535.0}, {"code": "", "desc": "TAPE, DOUBLE SIDE 2\"", "qty": 15.0, "uom": "EA", "up": 14.0}, {"code": "", "desc": "PAINT, BLUE STAINER", "qty": 24.0, "uom": "EA", "up": 5.45}, {"code": "", "desc": "STAINER PAINT,BLACK", "qty": 12.0, "uom": "EA", "up": 5.45}, {"code": "", "desc": "PAINT, A-YELLOW STAINER A", "qty": 12.0, "uom": "EA", "up": 5.45}, {"code": "", "desc": "CEMENT, FINISHING", "qty": 25.0, "uom": "BAG", "up": 29.0}, {"code": "", "desc": "SILICONE, SEALANT CLEAR/TRANSPARENT", "qty": 24.0, "uom": "EA", "up": 9.75}, {"code": "", "desc": "SILICONE, SEALANT WHITE", "qty": 24.0, "uom": "EA", "up": 9.75}], "created": "2026-06-04", "updated": "2026-06-04"}, {"id": "Q-2606-3900", "qno": "Q-2606-3900", "date": "2026-06-03", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Won", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "FUEL FILTER,2650201/4816636", "qty": 3.0, "uom": "EA", "up": 78.0}], "created": "2026-06-03", "updated": "2026-06-03"}, {"id": "Q-2606-3899", "qno": "Q-2606-3899", "date": "2026-06-02", "company": "ARNON PLASTIC COMPANY", "contact": "Mr.  Anzil", "city": "Riyadh,", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Project: Wall Tile Dismantling, Plastering, Painting, and Gate Repair Work at Paper Plant Entrance", "qty": 1.0, "uom": "Lot", "up": 12000.0}], "created": "2026-06-02", "updated": "2026-06-02"}, {"id": "Q-2606-3898", "qno": "Q-2606-3898", "date": "2026-06-02", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Won", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "PAINT,WHITE ENAMEL(MATT FINISH)526ME,18L", "qty": 5.0, "uom": "EA", "up": 565.0}], "created": "2026-06-02", "updated": "2026-06-02"}, {"id": "Q-2606-3894", "qno": "Q-2606-3894", "date": "2026-06-02", "company": "ARNON PLASTIC COMPANY", "contact": "Mr.  Anzil", "city": "Riyadh,", "ref": "", "status": "Lost", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Project: Old Cable Disconnecting and New Cable Installation Work\nZamil Chiller # 2 Unit", "qty": 1.0, "uom": "Lot", "up": 92870.0}], "created": "2026-06-02", "updated": "2026-06-02"}, {"id": "Q-2605-3893", "qno": "Q-2605-3893", "date": "2026-05-24", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Pvc Electrical conduit pipe 32 mm Black", "qty": 180.0, "uom": "EA", "up": 4.65}, {"code": "", "desc": "PVC Electrical Conduit Bend 32mm Black 90°", "qty": 115.0, "uom": "EA", "up": 7.0}, {"code": "", "desc": "PVC Electrical Conduit Bend 32mm Black 45°", "qty": 40.0, "uom": "EA", "up": 4.0}, {"code": "", "desc": "pvc Electrical 3way Square box black 32mm Black\ntee equal black 32mm Not Available", "qty": 40.0, "uom": "EA", "up": 18.5}, {"code": "", "desc": "PVC Cement 250gm", "qty": 4.0, "uom": "EA", "up": 14.5}, {"code": "", "desc": "Sikasil WS-305 S - Black", "qty": 45.0, "uom": "EA", "up": 27.0}], "created": "2026-05-24", "updated": "2026-05-24"}, {"id": "Q-2605-3892", "qno": "Q-2605-3892", "date": "2026-05-24", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Lost", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "PRESSURE GAUGE 2-1/2\" DIA 1/4\" CONN 4 BAR WINTER\nNot Available#PRESSURE GAUGE,1/4\",0-45 PSI(ECX270861)", "qty": 15.0, "uom": "EA", "up": 71.0}, {"code": "", "desc": "BRASS GATE VALVE 1-1/2\" PEGLER ENGLAND", "qty": 4.0, "uom": "EA", "up": 137.0}, {"code": "", "desc": "GMI REDUCER BUSH 1x3/4\" THRD", "qty": 5.0, "uom": "EA", "up": 8.0}, {"code": "", "desc": "CONTACTOR, 9A,220V", "qty": 20.0, "uom": "EA", "up": 110.0}, {"code": "", "desc": "FILTER, 19.5\"X19.5X0.78\" MERV13 DSWF19", "qty": 100.0, "uom": "EA", "up": 0}, {"code": "", "desc": "CLEANER, ELECTRO CONTACT (CRC)", "qty": 24.0, "uom": "EA", "up": 38.0}], "created": "2026-05-24", "updated": "2026-05-24"}, {"id": "Q-2605-3891", "qno": "Q-2605-3891", "date": "2026-05-24", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "BLOWER, HL-ZAMIL AHU - 80070746", "qty": 1.0, "uom": "EA", "up": 985.0}, {"code": "", "desc": "BELT, FAN - A-22", "qty": 5.0, "uom": "EA", "up": 9.5}, {"code": "", "desc": "TAPE, PIPE WRAPPING PVC BLACK 2\"", "qty": 48.0, "uom": "EA", "up": 3.95}, {"code": "", "desc": "BELT, FAN - B-36", "qty": 5.0, "uom": "EA", "up": 16.0}, {"code": "", "desc": "BELT, FAN - B-37", "qty": 3.0, "uom": "EA", "up": 16.0}], "created": "2026-05-24", "updated": "2026-05-24"}, {"id": "Q-2605-3890", "qno": "Q-2605-3890", "date": "2026-05-24", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "TUBE, OSRAM DULUX S/E 9W/840 LUMILUX 2G7", "qty": 50.0, "uom": "EA", "up": 16.55}, {"code": "", "desc": "DOOR LOCK CYLINDER,DC L120MM(30+90)YKSN\nPlease Provide Sample Picture", "qty": 2.0, "uom": "EA", "up": 0}], "created": "2026-05-24", "updated": "2026-05-24"}, {"id": "Q-2605-3889", "qno": "Q-2605-3889", "date": "2026-05-23", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "BATTERY, 6V, 330AH,  J305P-AC TROJAN MADE IN USA\nBATTERY, 6V, 320AH Not available", "qty": 6.0, "uom": "EA", "up": 1850.0}], "created": "2026-05-23", "updated": "2026-05-23"}, {"id": "Q-2605-3888", "qno": "Q-2605-3888", "date": "2026-05-23", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "SILICONE, SEALANT CLEAR/TRANSPARENT GP", "qty": 24.0, "uom": "EA", "up": 10.0}, {"code": "", "desc": "SILICONE, SEALANT WHITE GP", "qty": 24.0, "uom": "EA", "up": 10.0}, {"code": "", "desc": "BRUSH, PAINT 3\"", "qty": 24.0, "uom": "EA", "up": 4.75}, {"code": "", "desc": "PAINT, HEMPEL MARINE 52040 BLACK 19990", "qty": 2.0, "uom": "EA", "up": 245.00000000000003}, {"code": "", "desc": "BRUSH, PAINT 2\"", "qty": 24.0, "uom": "EA", "up": 4.25}], "created": "2026-05-23", "updated": "2026-05-23"}, {"id": "Q-2605-3887", "qno": "Q-2605-3887", "date": "2026-05-23", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "SAND FILTER,HAYWARD,S180T,68KG\nS180T FILTER-SAND 18 IN. W/T.M. VALVE, W/SAND\nSee the attached datasheet", "qty": 1.0, "uom": "EA", "up": 1895.0}], "created": "2026-05-23", "updated": "2026-05-23"}, {"id": "Q-2605-3886", "qno": "Q-2605-3886", "date": "2026-05-23", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "BLADE, HACKSAW DOUBLE SIDED", "qty": 10.0, "uom": "EA", "up": 1.55}], "created": "2026-05-23", "updated": "2026-05-23"}, {"id": "Q-2605-3885", "qno": "Q-2605-3885", "date": "2026-05-23", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Won", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "FILTER EXCHANGE RESIGN,UB3,3PCS/KIT", "qty": 2.0, "uom": "EA", "up": 1690.0}], "created": "2026-05-23", "updated": "2026-05-23"}, {"id": "Q-2605-3884", "qno": "Q-2605-3884", "date": "2026-05-23", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "EXTINGUISHER,FIRE DRYCHEM ABC,4.5KG", "qty": 3.0, "uom": "EA", "up": 53.0}], "created": "2026-05-23", "updated": "2026-05-23"}, {"id": "Q-2605-3883", "qno": "Q-2605-3883", "date": "2026-05-23", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Fire Stop Silicone sealant (4 hrs)", "qty": 25.0, "uom": "EA", "up": 44.0}], "created": "2026-05-23", "updated": "2026-05-23"}, {"id": "Q-2605-3882", "qno": "Q-2605-3882", "date": "2026-05-21", "company": "SD Middle East LLC", "contact": "Mr. Afsal", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Cotton Bundle 9.5kg - 10kg 100% pure white cotton", "qty": 10.0, "uom": "Bundle", "up": 97.99999999999999}, {"code": "", "desc": "Clorox-409", "qty": 10.0, "uom": "PCS", "up": 16.0}, {"code": "", "desc": "Silicon lubricant Permatex", "qty": 10.0, "uom": "PCS", "up": 48.0}, {"code": "", "desc": "SUPER MULTI PURPOSE Q20", "qty": 50.0, "uom": "PCS", "up": 15.5}, {"code": "", "desc": "Soft Pad ADHESIVE", "qty": 3.0, "uom": "Roll", "up": 920.0}, {"code": "", "desc": "Sticky Warning Tape 2inch (Black/Yellow) 25mtr.", "qty": 50.0, "uom": "PCS", "up": 28.0}, {"code": "", "desc": "Duct Tap", "qty": 50.0, "uom": "PCS", "up": 4.9}, {"code": "", "desc": "FG3 Floor Cleaner 5L", "qty": 50.0, "uom": "Gallon", "up": 54.0}, {"code": "", "desc": "Bearing 6004-2Z/C3 -SKF", "qty": 50.0, "uom": "PCS", "up": 14.25}, {"code": "", "desc": "Bearing 6200 -SKF", "qty": 50.0, "uom": "PCS", "up": 11.0}], "created": "2026-05-21", "updated": "2026-05-21"}, {"id": "Q-2605-3881", "qno": "Q-2605-3881", "date": "2026-05-21", "company": "SD Middle East LLC", "contact": "Mr. Afsal", "city": "Riyadh", "ref": "", "status": "Lost", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Safety Poster -Flex (915x732)MM", "qty": 2.0, "uom": "EA", "up": 150.0}], "created": "2026-05-21", "updated": "2026-05-21"}, {"id": "Q-2605-3880", "qno": "Q-2605-3880", "date": "2026-05-20", "company": "SD Middle East LLC", "contact": "Mr. Afsal", "city": "Riyadh", "ref": "", "status": "Lost", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Material Flow Diagram Banner W:161.5 cm,  H:113.5 cm", "qty": 1.0, "uom": "EA", "up": 210.0}, {"code": "", "desc": "Photo Print for frame 40x50 cm", "qty": 3.0, "uom": "EA", "up": 85.0}], "created": "2026-05-20", "updated": "2026-05-20"}, {"id": "Q-2605-3879", "qno": "Q-2605-3879", "date": "2026-05-20", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "PAINT,STUCCO ACRYLIC EMULSION COL-M-161", "qty": 3.0, "uom": "EA", "up": 229.0}], "created": "2026-05-20", "updated": "2026-05-20"}, {"id": "Q-2605-3878", "qno": "Q-2605-3878", "date": "2026-05-20", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "GREASE SEAL ; AL KAWN (712-6324-653)", "qty": 12.0, "uom": "EA", "up": 59.0}, {"code": "", "desc": "FILTER - CLARKE FIRE PROTECT (RE57394)", "qty": 4.0, "uom": "EA", "up": 178.0}, {"code": "", "desc": "CI BUTTER FLY VALVE 4\" (DN-100) SSTL DISC ECI\nSee the attached picture for approval.", "qty": 4.0, "uom": "EA", "up": 285.0}], "created": "2026-05-20", "updated": "2026-05-20"}, {"id": "Q-2605-3877", "qno": "Q-2605-3877", "date": "2026-05-20", "company": "ARNON PLASTIC COMPANY", "contact": "Mr.  Anzil", "city": "Riyadh,", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Supply and installation of cable and cable try at big grinder area.", "qty": 1.0, "uom": "Lot", "up": 9600.0}], "created": "2026-05-20", "updated": "2026-05-20"}, {"id": "Q-2605-3875", "qno": "Q-2605-3875", "date": "2026-05-20", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Won", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "SUBMERSIBLE PUMP,MODEL,UNILIFT KP350\nVoltage: 1x230V\nIn: 3.2 Amp\nFlow: 6.0 m3/h\nPressure: 6.6 mts\nP/n: UNILIFT KP 350.A1\nBrand: GRUNDFOS", "qty": 2.0, "uom": "EA", "up": 2875.0}, {"code": "", "desc": "GREASE, MULTI PURPOSE SKF LMGT 3/1 (1KG)", "qty": 5.0, "uom": "EA", "up": 48.0}, {"code": "", "desc": "TAPE, TEFLON 12MMX0.075MMX10M", "qty": 500.0, "uom": "EA", "up": 6.95}], "created": "2026-05-20", "updated": "2026-05-20"}, {"id": "Q-2605-3874", "qno": "Q-2605-3874", "date": "2026-05-20", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "BOX, MEDIUM MT SIZE:500X500X470", "qty": 100.0, "uom": "EA", "up": 11.0}], "created": "2026-05-20", "updated": "2026-05-20"}, {"id": "Q-2605-3873", "qno": "Q-2605-3873", "date": "2026-05-20", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Won", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "CABLE, 3 CORE 2.5MM,91.40MTR/ROLL", "qty": 2.0, "uom": "EA", "up": 345.0}, {"code": "", "desc": "LED,4X0.06W,220-240V,4V,2AH\n\n(EMERGENCY LIGHT)", "qty": 10.0, "uom": "EA", "up": 395.0}], "created": "2026-05-20", "updated": "2026-05-20"}, {"id": "Q-2605-3872", "qno": "Q-2605-3872", "date": "2026-05-20", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "TUNGSRAM LED ECO CLA60 9W 965 E27 TUSADS", "qty": 25.0, "uom": "EA", "up": 6.5}, {"code": "", "desc": "HEAVY DUTY PLUG,30A,220V,3PIN-BLACK COL", "qty": 10.0, "uom": "EA", "up": 9.0}, {"code": "", "desc": "CONDUIT, FLEXIBLE STEEL 3/4\" LFMC GRAY", "qty": 2.0, "uom": "ROL", "up": 241.0}, {"code": "", "desc": "SWITCH, 2GANG 2-WAY-10AX-250V LEGRAND", "qty": 5.0, "uom": "EA", "up": 92.0}, {"code": "", "desc": "OSRAM Fluorescent Lamp L8W830 3000K T5 16mm DIA", "qty": 100.0, "uom": "EA", "up": 8.75}, {"code": "", "desc": "OSRAM MH BALLAST PT-FIT 35W/220-240 S", "qty": 12.0, "uom": "EA", "up": 91.0}, {"code": "", "desc": "SOCKET,COVER LEGRAND MOSAIC ADAPTER69580", "qty": 15.0, "uom": "EA", "up": 29.75}, {"code": "", "desc": "TAPE, ELECTRICAL (PVC) WHITE", "qty": 30.0, "uom": "EA", "up": 3.95}, {"code": "", "desc": "SWITCH BUTTON RUN&STOP ELECTRIC POWER", "qty": 1.0, "uom": "EA", "up": 0}, {"code": "", "desc": "LED STRIP LIGHT RGB 3.6 WATT,24VDC", "qty": 10.0, "uom": "EA", "up": 185.0}, {"code": "", "desc": "TABLE LAMP BULB,60W,220V,E27", "qty": 20.0, "uom": "EA", "up": 0}], "created": "2026-05-20", "updated": "2026-05-20"}, {"id": "Q-2605-3871", "qno": "Q-2605-3871", "date": "2026-05-19", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Lost", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "PAINT,ENAMEL GRAY,3.75LTR/CAN -", "qty": 1.0, "uom": "EA", "up": 265.0}, {"code": "", "desc": "PAINT, ENAMEL RED 3.79 Liters", "qty": 4.0, "uom": "EA", "up": 245.0}, {"code": "", "desc": "PAINT, ENAMEL NAVY BLUE 3.79 Liters", "qty": 2.0, "uom": "EA", "up": 275.0}, {"code": "", "desc": "PAINT, HEMPEL MARINE 52040 YELLOW 20161 3.79 Liters", "qty": 2.0, "uom": "EA", "up": 245.0}, {"code": "", "desc": "PAINT, ENAMEL GREEN 3.79 Liters", "qty": 2.0, "uom": "EA", "up": 265.0}], "created": "2026-05-19", "updated": "2026-05-19"}, {"id": "Q-2605-3869", "qno": "Q-2605-3869", "date": "2026-05-19", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Blower Pillow with bearing., SNR ES 210 G2\nInner Diameter(Shaft Dia - 50MM)", "qty": 10.0, "uom": "EA", "up": 145.0}], "created": "2026-05-19", "updated": "2026-05-19"}, {"id": "Q-2605-3868", "qno": "Q-2605-3868", "date": "2026-05-19", "company": "SD Middle East LLC", "contact": "Mr. Afsal", "city": "Riyadh", "ref": "", "status": "Won", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "I phone 16 128 GB Black\nDual SIM (nano-SIM and eSIM)", "qty": 3.0, "uom": "EA", "up": 3345.0}, {"code": "", "desc": "I Phone 17 256 GB Black\nDual eSIM (eSIM/eSIM)", "qty": 3.0, "uom": "EA", "up": 3875.0}, {"code": "", "desc": "Samsung S26 256 GB Black/White\nDual SIM (nano-SIM and eSIM)", "qty": 3.0, "uom": "EA", "up": 4150.0}, {"code": "", "desc": "Samsung S25 256 GB, Silver Shadow/Icy Blue\nDual SIM (nano-SIM and eSIM)", "qty": 3.0, "uom": "EA", "up": 2950.0}, {"code": "", "desc": "I phone 16 Plus 256 GB, Black\nDual SIM (nano-SIM and eSIM)", "qty": 3.0, "uom": "EA", "up": 4395.0}], "created": "2026-05-19", "updated": "2026-05-19"}, {"id": "Q-2605-3867", "qno": "Q-2605-3867", "date": "2026-05-19", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "PCB SUB ASSEMBLY,EBR393195\nNot Available", "qty": 2.0, "uom": "EA", "up": 0}, {"code": "", "desc": "PILLOW BLOCK BEARING,P204(UC204)", "qty": 2.0, "uom": "EA", "up": 58.0}, {"code": "", "desc": "BEARING PILLOW BLOCK-ASE05 FOR FCU", "qty": 4.0, "uom": "EA", "up": 53.0}, {"code": "", "desc": "BLOWER PILLOW WITH BEARING SKFP208", "qty": 4.0, "uom": "EA", "up": 169.0}, {"code": "", "desc": "PILLOW BLOCK BEARING,P207", "qty": 2.0, "uom": "EA", "up": 92.0}], "created": "2026-05-19", "updated": "2026-05-19"}, {"id": "Q-2605-3866", "qno": "Q-2605-3866", "date": "2026-05-19", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "OPENER, DRAIN 1LTR", "qty": 5.0, "uom": "EA", "up": 22.0}, {"code": "", "desc": "HOSE, FLEXIBLE 30CM X 1/2\" X 1/2\"", "qty": 10.0, "uom": "EA", "up": 11.0}, {"code": "", "desc": "HOSE, FLEXIBLE 60CM X 1/2\" X 1/2\"", "qty": 15.0, "uom": "EA", "up": 12.0}, {"code": "", "desc": "PAINT, SPRAY BLUE ABRO", "qty": 12.0, "uom": "EA", "up": 8.5}, {"code": "", "desc": "PAINT, SPRAY GRAY ABRO", "qty": 12.0, "uom": "EA", "up": 8.5}, {"code": "", "desc": "P-TRAP FOR BIDET,CHROME PLATED,1-1/4\"", "qty": 12.0, "uom": "EA", "up": 49.0}, {"code": "", "desc": "BEARING,6206-2Z-C3,SKF", "qty": 8.0, "uom": "EA", "up": 25.5}, {"code": "", "desc": "CLAMP SADDLE 2” ,THREADED HOLE 1/2\",HDPE", "qty": 4.0, "uom": "EA", "up": 23.0}, {"code": "", "desc": "VALVE, FLOAT 1\"", "qty": 10.0, "uom": "EA", "up": 64.0}, {"code": "", "desc": "BEARING,BALL 6204 DEEP GROOVE 6204ZZC3", "qty": 10.0, "uom": "EA", "up": 16.0}], "created": "2026-05-19", "updated": "2026-05-19"}, {"id": "Q-2605-3865", "qno": "Q-2605-3865", "date": "2026-05-18", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "BOLT CUTTER, STANLEY, P/N:1-17-752, 24\"(600MM)", "qty": 1.0, "uom": "EA", "up": 163.0}], "created": "2026-05-18", "updated": "2026-05-18"}, {"id": "Q-2605-3864", "qno": "Q-2605-3864", "date": "2026-05-18", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Lost", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "DETECTOR, SMOKE TESTER", "qty": 36.0, "uom": "EA", "up": 38.5}], "created": "2026-05-18", "updated": "2026-05-18"}, {"id": "Q-2605-3863", "qno": "Q-2605-3863", "date": "2026-05-18", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Lost", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "OIL, ENGINE 10W-30 CASTROL GTX\nSee the attached picture for approval", "qty": 10.0, "uom": "EA", "up": 28.0}], "created": "2026-05-18", "updated": "2026-05-18"}, {"id": "Q-2605-3862", "qno": "Q-2605-3862", "date": "2026-05-18", "company": "SD Middle East LLC", "contact": "Mr. Afsal", "city": "Riyadh", "ref": "", "status": "Lost", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Microwave Oven Repair Service\n - Motor and plate replacement", "qty": 1.0, "uom": "EA", "up": 135.0}], "created": "2026-05-18", "updated": "2026-05-18"}, {"id": "Q-2605-3861", "qno": "Q-2605-3861", "date": "2026-05-18", "company": "SD Middle East LLC", "contact": "Mr. Afsal", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "HP LCD Monitor 524pf Series 5 Pro 23.8\" FHD, 9D9L6UT", "qty": 3.0, "uom": "EA", "up": 775.0}, {"code": "", "desc": "DELL Wireless Keyboard & Mouse KM3322W -Arabic Black", "qty": 3.0, "uom": "EA", "up": 99.0}, {"code": "", "desc": "Logitech USB Headset H340, 981-000475, Black", "qty": 3.0, "uom": "EA", "up": 110.0}], "created": "2026-05-18", "updated": "2026-05-18"}, {"id": "Q-2605-3860", "qno": "Q-2605-3860", "date": "2026-05-18", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "OIL,4LTR,005MM(FOR SMG MACHINE)\n\nMobil HEAVY DUTY DEISEL ENGINE SAE-15W-40\nSee the attached picture for approval", "qty": 2.0, "uom": "EA", "up": 75.0}], "created": "2026-05-18", "updated": "2026-05-18"}, {"id": "Q-2605-3855", "qno": "Q-2605-3855", "date": "2026-05-16", "company": "SD Middle East LLC", "contact": "Mrs. Bhavana", "city": "Jeddah, KSA", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Avoban Antibactirial  Ointment -10 gm", "qty": 4.0, "uom": "Pack", "up": 29.0}, {"code": "", "desc": "Tea bag  100pcs/Pack", "qty": 15.0, "uom": "Pack", "up": 58.0}, {"code": "", "desc": "Sugar brown", "qty": 12.0, "uom": "KG", "up": 19.5}, {"code": "", "desc": "Rainbow milk 96x160ml 96Pcs/Box", "qty": 2.0, "uom": "BOX", "up": 325.0}, {"code": "", "desc": "Powder Milk Almarai /Anchor", "qty": 10.0, "uom": "KG", "up": 47.5}, {"code": "", "desc": "Nescafe Gold Coffee 200g", "qty": 9.0, "uom": "EA", "up": 52.0}, {"code": "", "desc": "Print label roll -Printer label roll - Adhesive Thermal labels \n(4x6 inch) # (100x150 mm).", "qty": 100.0, "uom": "Pcs", "up": 47.0}, {"code": "", "desc": "M8 x 35mm Allen Bolt, Alloy Steel 10.9 Grade Punched Color:Black", "qty": 30.0, "uom": "Pcs", "up": 6.25}, {"code": "", "desc": "Multipurpose  Grease EP-2 -NLGI Grade 2. \nSee the datasheet for your approval.", "qty": 32.0, "uom": "KG", "up": 57.5}, {"code": "", "desc": "Encore EN388 Gloves/Empiral-Hand Gloves", "qty": 200.0, "uom": "Pair", "up": 2.75}, {"code": "", "desc": "Masking Tape", "qty": 10.0, "uom": "Pcs", "up": 4.5}, {"code": "", "desc": "CONSUMABLES : Cotton waste HQ-White Clr, Cotton 100%", "qty": 100.0, "uom": "KG", "up": 14.5}, {"code": "", "desc": "Micro SD Memory Card 256 GB", "qty": 4.0, "uom": "Pcs", "up": 165.0}], "created": "2026-05-16", "updated": "2026-05-16"}, {"id": "Q-2605-3854", "qno": "Q-2605-3854", "date": "2026-05-13", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Won", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "PAINT, ROAD BLACK 18 LTR HEMPEL 18 LTR\nHempels-wb-airfield-road-marking-28101", "qty": 1.0, "uom": "EA", "up": 580.0}], "created": "2026-05-13", "updated": "2026-05-13"}, {"id": "Q-2605-3852", "qno": "Q-2605-3852", "date": "2026-05-12", "company": "SD Middle East LLC", "contact": "Mr. Afsal", "city": "Riyadh", "ref": "", "status": "Lost", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Snake plant indoor live plant with pot", "qty": 4.0, "uom": "Pcs", "up": 140.0}], "created": "2026-05-12", "updated": "2026-05-12"}, {"id": "Q-2605-2605103850R1", "qno": "Q-2605-2605103850R1", "date": "2026-05-10", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Expired", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Miniature plug in relay, Harmony Electromechanical Relays, 6A, 4CO, lockable test but to n, 12V DC\nPart Number - RXM4AB1JD\nBrand - Schneider", "qty": 110.0, "uom": "EA", "up": 20.45}, {"code": "", "desc": "The base of the relay with part number RXZE2M114M", "qty": 110.0, "uom": "EA", "up": 11.65}], "created": "2026-05-10", "updated": "2026-05-10"}, {"id": "Q-2605-3846", "qno": "Q-2605-3846", "date": "2026-05-09", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Expired", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "BATTERY,12V,9AH,RECHARGEABLE, Long, WP1236W", "qty": 355.0, "uom": "EA", "up": 77.0}], "created": "2026-05-09", "updated": "2026-05-09"}, {"id": "Q-2605-3845", "qno": "Q-2605-3845", "date": "2026-05-07", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Lost", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Hempel Maestro gloss enamel 52040  3.9L", "qty": 4.0, "uom": "EA", "up": 255.0}], "created": "2026-05-07", "updated": "2026-05-07"}, {"id": "Q-2605-3844", "qno": "Q-2605-3844", "date": "2026-05-06", "company": "SD Middle East LLC", "contact": "Mr. Afsal", "city": "Riyadh", "ref": "", "status": "Won", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Purchase of Scrap Materials\nScope of Materials:\n- Car Park Office dismantled materials\n- Laydown Warehouse materials\n- Car Park Store dismantled materials\n- Test bags\n- Steel structure scrap materials\n- Cables and wires\n- Electrical Material Stock Inventory\n- Electrical Old Material Stock Inventory\n- IT Material Stock Inventory", "qty": 1.0, "uom": "Lot", "up": 121000.0}, {"code": "", "desc": "Cabin and Container\n- 1 Toilet cabin\n\n- 1x20 feet container\n\n- One 6 x 3 meter Office Porta Cabin", "qty": 1.0, "uom": "Lot", "up": 4800.0}], "created": "2026-05-06", "updated": "2026-05-06"}, {"id": "Q-2605-3843", "qno": "Q-2605-3843", "date": "2026-05-03", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Won", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "PAINT,STUCCO ACRYLIC EMULSION COL-M-161", "qty": 2.0, "uom": "EA", "up": 229.0}], "created": "2026-05-03", "updated": "2026-05-03"}, {"id": "Q-2605-3842", "qno": "Q-2605-3842", "date": "2026-05-03", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Expired", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "PAINT, ROLLER 7\"", "qty": 25.0, "uom": "EA", "up": 12.75}], "created": "2026-05-03", "updated": "2026-05-03"}, {"id": "Q-2605-3841", "qno": "Q-2605-3841", "date": "2026-05-02", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Won", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "GREASE, MULTI PURPOSE SKF LMGT 3/1 (1KG)", "qty": 3.0, "uom": "EA", "up": 48.0}, {"code": "", "desc": "WATER FLOW DETECTOR,WFD40,4\",VANE TYPE", "qty": 2.0, "uom": "EA", "up": 0}, {"code": "", "desc": "BATTERY 12V 18AH\nLECXO LX18-12 See the attached datasheet", "qty": 2.0, "uom": "EA", "up": 127.0}, {"code": "", "desc": "BATTERY, AA DURACELL", "qty": 200.0, "uom": "EA", "up": 1.9}, {"code": "", "desc": "FREON,GAS R410A USA,25LBS,13.3KG HONEYWELL MADE IN USA", "qty": 2.0, "uom": "EA", "up": 780.0}], "created": "2026-05-02", "updated": "2026-05-02"}, {"id": "Q-2605-3840", "qno": "Q-2605-3840", "date": "2026-05-02", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Won", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Hempel's WB Airfield & Road Marking 28101 White\nWHITE HEMPEL 569ME - Item not Available", "qty": 10.0, "uom": "EA", "up": 525.0}, {"code": "", "desc": "Hempel's WB Airfield & Road Marking 28101 Yellow\nYELLOW 569ME  HEMPEL -  Item not Available", "qty": 10.0, "uom": "EA", "up": 675.0}], "created": "2026-05-02", "updated": "2026-05-02"}, {"id": "Q-2604-3839", "qno": "Q-2604-3839", "date": "2026-04-30", "company": "SD Middle East LLC", "contact": "Mr. Afsal", "city": "Riyadh", "ref": "", "status": "Won", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Metal Cabinet Lock with Handle – Beige (Cyber Lock)", "qty": 36.0, "uom": "Pcs", "up": 34.75}], "created": "2026-04-30", "updated": "2026-04-30"}, {"id": "Q-2604-3837", "qno": "Q-2604-3837", "date": "2026-04-29", "company": "ARNON PLASTIC COMPANY", "contact": "Mr.  Anzil", "city": "Riyadh,", "ref": "", "status": "Won", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "PE Warehouse Epoxy Repair Works (Damaged Floor Area)", "qty": 1.0, "uom": "Lot", "up": 4700.0}, {"code": "", "desc": "Pandera Warehouse Epoxy Repair Works (Damaged Floor Area)", "qty": 1.0, "uom": "Lot", "up": 9900.0}, {"code": "", "desc": "PTE Warehouse Epoxy Repair Works (Damaged Floor Area)", "qty": 1.0, "uom": "Lot", "up": 3670.0}, {"code": "", "desc": "Bottle Warehouse Epoxy Repair Works (Damaged Floor Area)", "qty": 1.0, "uom": "Lot", "up": 13300.0}, {"code": "", "desc": "Sun Wheel Warehouse Epoxy Repair Works (Damaged Floor Area)", "qty": 1.0, "uom": "Lot", "up": 56000.0}, {"code": "", "desc": "Paper Plant Warehouse Epoxy Repair Works (Damaged Floor Area)", "qty": 1.0, "uom": "Lot", "up": 3200.0}], "created": "2026-04-29", "updated": "2026-04-29"}, {"id": "Q-2606-3830", "qno": "Q-2606-3830", "date": "2026-06-15", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Sent", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Tire 445/65/22.5 PR18_Outrigger (Michelin Group) with Foam Filling 305 Unit/Tire", "qty": 1.0, "uom": "EA", "up": 15875.0}], "created": "2026-06-15", "updated": "2026-06-15"}, {"id": "Q-2605-3829", "qno": "Q-2605-3829", "date": "2026-05-03", "company": "ARNON PLASTIC COMPANY", "contact": "Mr.  Anzil", "city": "Riyadh,", "ref": "", "status": "Expired", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Sandwich Panel Partition Removal", "qty": 1.0, "uom": "Lot", "up": 12000.0}, {"code": "", "desc": "Construction of New Spare Parts Store.", "qty": 1.0, "uom": "Lot", "up": 24000.0}], "created": "2026-05-03", "updated": "2026-05-03"}, {"id": "Q-2605-3829", "qno": "Q-2605-3829", "date": "2026-05-03", "company": "ARNON PLASTIC COMPANY", "contact": "Mr.  Anzil", "city": "Riyadh,", "ref": "", "status": "Won", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "Project: Sandwich Panel Partition Removal and Complete Store Setup", "qty": 1.0, "uom": "Lot", "up": 36000.0}], "created": "2026-05-03", "updated": "2026-05-03"}, {"id": "Q-2606-3827", "qno": "Q-2606-3827", "date": "2026-06-11", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "ref": "", "status": "Won", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "PAINT,JOTASHIELD COLOURLAST 16.2L EXTERIOR MATT BASE A 1334 PURE BARLEY", "qty": 5.0, "uom": "EA", "up": 395.0}], "created": "2026-06-11", "updated": "2026-06-11"}, {"id": "Q-2605-R12605213665", "qno": "Q-2605-R12605213665", "date": "2026-05-21", "company": "SD Middle East LLC", "contact": "Mrs. Bhavana", "city": "Jeddah, KSA", "ref": "", "status": "Lost", "validity": 7, "delivery": "2–4 weeks from PO", "payment": "Net 2 weeks", "notes": "", "discount": 0, "items": [{"code": "", "desc": "File cabinet 90x186 Cm (For storing files)", "qty": 1.0, "uom": "Pcs", "up": 1350.0}], "created": "2026-05-21", "updated": "2026-05-21"}]; }
function getDefaultCustomers() { return [{"id": "sd_middle_east_llc", "company": "SD Middle East LLC", "contact": "Ms. Anna", "city": "Riyadh", "phone": "", "email": ""}, {"id": "ak_investment_compan", "company": "AK Investment Company", "contact": "Mr. Faisal", "city": "Riyadh", "phone": "", "email": ""}, {"id": "snc_lavalin_arabia", "company": "SNC Lavalin Arabia", "contact": "Mr. Imthiyaz", "city": "Riyadh", "phone": "", "email": ""}, {"id": "gdcme", "company": "GDCME", "contact": "Mr.  Abdulaziz", "city": "7960 Othman Bin Affan, 4108 Al Taawun 12478", "phone": "", "email": ""}, {"id": "arnon_plastic_compan", "company": "ARNON PLASTIC COMPANY", "contact": "Mr.  Anzil", "city": "Riyadh,", "phone": "", "email": ""}, {"id": "mohg", "company": "MOHG", "contact": "Meshal", "city": "Riyadh", "phone": "", "email": ""}, {"id": "al_hammadi", "company": "Al Hammadi", "contact": "Mr. Abdulaziz", "city": "Riyadh", "phone": "", "email": ""}, {"id": "edarat_group", "company": "Edarat Group", "contact": "Mr. Nabhan", "city": "Riyadh", "phone": "", "email": ""}]; }
/* ── Address helpers ── */
function buildAddressLine1(s) {
  const parts = [];
  if (s.building) parts.push('Building No. ' + s.building);
  if (s.street)   parts.push(s.street);
  if (s.secondary)parts.push('Secondary No. ' + s.secondary);
  return parts.join(', ');
}
function buildAddressLine2(s) {
  const parts = [];
  if (s.district) parts.push(s.district);
  if (s.city)     parts.push(s.city);
  if (s.postal)   parts.push(s.postal);
  return parts.join(', ');
}

function buildPrintHeaderInfo(s) {
  const line1 = [];
  if (s.cr)  line1.push('CR No: ' + s.cr);
  if (s.vat) line1.push('VAT No: ' + s.vat);
  const lines = [];
  if (line1.length) lines.push(line1.join(' &nbsp; | &nbsp; '));
  if (s.email) lines.push(s.email);
  return lines.join('<br>');
}
function buildPrintFooterAddress(s) {
  const parts = [];
  if (s.building) parts.push('Building No. ' + s.building);
  if (s.street)   parts.push(s.street);
  if (s.district) parts.push(s.district);
  if (s.postal)   parts.push(s.postal);
  if (s.city)     parts.push(s.city);
  if (s.country)  parts.push(s.country);
  return parts.join(', ') || 'Riyadh, Saudi Arabia';
}
function buildPrintFooterInfo(s) {
  const parts = [];
  if (s.phone)   parts.push('Tel: ' + s.phone);
  if (s.mobile)  parts.push('Mobile: ' + s.mobile);
  if (s.email)   parts.push('Email: ' + s.email);
  if (s.website) parts.push(s.website);
  return parts.join(' &nbsp; | &nbsp; ');
}

function getDefaultEmployees() {
  return [];
}

function getDefaultSettings() {
  return {coname:'Downtown Trading Est.',conameAr:'',tagline:'Trading & Contracting',cr:'',building:'',street:'',secondary:'',district:'',postal:'',city:'Riyadh',country:'Saudi Arabia',pobox:'',phone:'+966 XX XXX XXXX',mobile:'',email:'info@downtowntrading.com',vat:'3XXXXXXXXXXXXXXXXX',website:'',closingMessage:'Thank you for the opportunity to serve you.',vatrate:15,validity:7,rfqDefaultHours:48,delivery:'2–4 weeks from confirmed PO',payment:'Net 2 weeks from invoice date',logo:'',signature:'',stamp:'',documentNumbering:{rfq:{prefix:'RFQ',reset:'monthly'},pricing:{prefix:'PR',reset:'monthly'},quotation:{prefix:'Q',reset:'monthly'},salesOrder:{prefix:'SO',reset:'monthly'},deliveryNote:{prefix:'DN',reset:'monthly'},customerInvoice:{prefix:'INV',reset:'monthly'},purchaseOrder:{prefix:'PO',reset:'monthly'},purchaseInvoice:{prefix:'PI',reset:'monthly'}}};
}

/* ── SETTINGS ── */
function setBrandAssetPreview(type, value) {
  const wrap = document.getElementById(type + '-preview-wrap');
  const remove = document.getElementById('remove-' + type);
  if (!wrap) return;
  const labels = {logo:['ti-photo-up','Upload logo<br>Recommended 600 × 240 px'],signature:['ti-signature','Upload signature<br>Transparent PNG preferred'],stamp:['ti-rosette-discount-check','Upload stamp<br>Transparent PNG preferred']};
  if (value) {
    wrap.className = '';
    wrap.innerHTML = `<img src="${value}" alt="${type}">`;
    if (remove) remove.style.display='inline-block';
  } else {
    const x=labels[type];
    wrap.className='empty';
    wrap.innerHTML=`<i class="ti ${x[0]}"></i><span>${x[1]}</span>`;
    if (remove) remove.style.display='none';
  }
}

function applySettings() {
  document.getElementById('sb-co-name').textContent = settings.coname || 'Downtown Trading Est.';
  // Sidebar keeps the BizCore mark (set once in the HTML) rather than the
  // company logo — a small square slot isn't the right shape for a wide
  // wordmark logo. The company logo is still used correctly elsewhere
  // (quotation headers, PDFs) via settings.logo directly.
  const map={coname:'coname',conameAr:'coname-ar',tagline:'tagline',cr:'cr',building:'building',street:'street',secondary:'secondary',district:'district',postal:'postal',city:'city',country:'country',pobox:'pobox',phone:'phone',mobile:'mobile',email:'email',vat:'vat',website:'website',closingMessage:'closing-message'};
  Object.entries(map).forEach(([key,id])=>{const node=document.getElementById('s-'+id);if(node)node.value=settings[key]||'';});
  const vh=document.getElementById('s-rfqhours');if(vh)vh.value=settings.rfqDefaultHours||48;
  const vl=document.getElementById('s-validity');if(vl)vl.value=settings.validity||7;
  const dl=document.getElementById('s-delivery');if(dl)dl.value=settings.delivery||'';
  const pl=document.getElementById('s-payment');if(pl)pl.value=settings.payment||'';
  const vatLabel=document.getElementById('t-vat-label');if(vatLabel)vatLabel.textContent=`VAT (${getQuoteVatPercent()}%)`;
  ['logo','signature','stamp'].forEach(k=>setBrandAssetPreview(k,settings[k]||''));
  updateBrandPreview();
  renderDocumentNumbering();
}

function updateBrandPreview(){
  const val=(id,fallback='')=>document.getElementById(id)?.value.trim()||fallback;
  const name=val('s-coname',settings.coname||'Downtown Trading Est.');
  const ar=val('s-coname-ar',settings.conameAr||'');
  const tagline=val('s-tagline',settings.tagline||'Trading & Contracting');
  const city=val('s-city',settings.city||'Riyadh');
  const country=val('s-country',settings.country||'Saudi Arabia');
  const phone=val('s-phone',settings.phone||'');
  const email=val('s-email',settings.email||'');
  const n=document.getElementById('bp-company-name');if(n)n.textContent=name;
  const a=document.getElementById('bp-company-ar');if(a){a.textContent=ar;a.style.display=ar?'block':'none';}
  const t=document.getElementById('bp-tagline');if(t)t.textContent=tagline;
  const logo=document.getElementById('bp-logo');if(logo)logo.innerHTML=settings.logo?`<img src="${settings.logo}" alt="Logo">`:'COMPANY LOGO';
  const parts=[city,country,phone?('Tel: '+phone):'',email].filter(Boolean);
  const f=document.getElementById('bp-footer');if(f)f.innerHTML=parts.join(' &nbsp; | &nbsp; ');
}

let _brandAssetUploadPromises = {};
let _brandAssetUploadFailed = {};
function handleBrandAssetUpload(type,e){
  const file=e.target.files[0];if(!file)return;
  if(file.size>2.5*1024*1024){showToast('Please select an image smaller than 2.5 MB','error');e.target.value='';return;}
  const localPreview = URL.createObjectURL(file); // instant preview, no base64 needed
  settings[type]=localPreview;_brandAssetUploadFailed[type]=false;setBrandAssetPreview(type,localPreview);updateBrandPreview();
  if (window.FB) {
    showToast(`Uploading ${type}…`,'success');
    _brandAssetUploadPromises[type] = window.FB.uploadFile('branding/'+type, file).then(url=>{
      if (url) {
        URL.revokeObjectURL(localPreview);
        settings[type]=url; _brandAssetUploadFailed[type]=false; setBrandAssetPreview(type,url); updateBrandPreview();
        showToast(`${type.charAt(0).toUpperCase()+type.slice(1)} ready — save branding to apply`,'success');
      } else {
        _brandAssetUploadFailed[type]=true;
        showToast(`${type} upload failed — please try again before saving`,'error');
      }
      return url;
    });
  } else {
    showToast(`${type.charAt(0).toUpperCase()+type.slice(1)} ready — save branding to apply`,'success');
  }
}
function handleLogoUpload(e){handleBrandAssetUpload('logo',e);}
function removeBrandAsset(type){settings[type]='';delete _brandAssetUploadPromises[type];_brandAssetUploadFailed[type]=false;if(window.FB)window.FB.deleteFile('branding/'+type);setBrandAssetPreview(type,'');updateBrandPreview();showToast(`${type.charAt(0).toUpperCase()+type.slice(1)} removed — save to apply`);}

async function saveSetup() {
  const pendingBrandUploads = Object.values(_brandAssetUploadPromises).filter(Boolean);
  if (pendingBrandUploads.length) { showToast('Finishing upload…','success'); await Promise.all(pendingBrandUploads); _brandAssetUploadPromises = {}; }
  if (Object.values(_brandAssetUploadFailed).some(Boolean)) { showValidationDialog('Upload failed','A branding image could not be uploaded. Check your connection and try selecting it again, or remove it and save without one.',document.getElementById('s-coname')); return; }
  const read=(id,current='')=>{const e=document.getElementById(id);return e?e.value.trim():current;};
  settings.coname=read('s-coname',settings.coname)||'Downtown Trading Est.';
  settings.conameAr=read('s-coname-ar',settings.conameAr);
  settings.tagline=read('s-tagline',settings.tagline);
  settings.cr=read('s-cr',settings.cr);settings.vat=read('s-vat',settings.vat);
  settings.building=read('s-building',settings.building);settings.street=read('s-street',settings.street);settings.secondary=read('s-secondary',settings.secondary);settings.district=read('s-district',settings.district);settings.postal=read('s-postal',settings.postal);settings.city=read('s-city',settings.city);settings.country=read('s-country',settings.country);settings.pobox=read('s-pobox',settings.pobox);
  settings.phone=read('s-phone',settings.phone);settings.mobile=read('s-mobile',settings.mobile);settings.email=read('s-email',settings.email);settings.website=read('s-website',settings.website);settings.closingMessage=read('s-closing-message',settings.closingMessage);
  const validity=document.getElementById('s-validity');if(validity)settings.validity=parseInt(validity.value)||7;
  const rfq=document.getElementById('s-rfqhours');if(rfq)settings.rfqDefaultHours=parseInt(rfq.value)||48;
  await saveSettings();applySettings();showToast('Company settings saved','success');
}

/* ── HELPERS ── */
function formatNumber(n, decimals=2) {
  const value = Number(n);
  return Number.isFinite(value)
    ? value.toLocaleString('en-US',{minimumFractionDigits:decimals,maximumFractionDigits:decimals})
    : (0).toLocaleString('en-US',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
}
function formatQuantity(n) {
  const value = Number(n);
  return Number.isFinite(value)
    ? value.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2})
    : '0';
}
function formatPercent(n) { return formatNumber(n,2)+'%'; }
const CURRENCY_DISPLAY_MODULES=['rfq','pricing','quotation','salesOrder','deliveryNote','customerInvoice','purchaseOrder','purchaseInvoice'];
const DEFAULT_CURRENCY_DISPLAY={showLineUnitPrice:false,showLineAmount:false,showSummary:true,showGrandTotal:true,modules:Object.fromEntries(CURRENCY_DISPLAY_MODULES.map(k=>[k,true]))};
let currencyDisplayDraft=null;
function ensureCurrencyDisplaySettings(){const saved=settings.currencyDisplay||{};settings.currencyDisplay={...DEFAULT_CURRENCY_DISPLAY,...saved,modules:{...DEFAULT_CURRENCY_DISPLAY.modules,...(saved.modules||{})}};return settings.currencyDisplay;}
function currencyCode(){return (typeof activePricingSettings==='function'&&activePricingSettings().currency)||settings.currency||'SAR';}
function formatCurrencyDisplay(n,show=true){const num=formatNumber(n,2);return show?currencyCode()+' '+num:num;}
function currencyDisplayEnabled(module){return ensureCurrencyDisplaySettings().modules[module]!==false;}
function documentMoney(module,placement,n){const c=ensureCurrencyDisplaySettings();const visible=currencyDisplayEnabled(module)&&(placement==='unitPrice'?c.showLineUnitPrice:placement==='lineAmount'?c.showLineAmount:placement==='grandTotal'?c.showGrandTotal:c.showSummary);return formatCurrencyDisplay(n,visible);}
function qvLineUnitMoney(n){return documentMoney('quotation','unitPrice',n);}
function qvLineAmountMoney(n){return documentMoney('quotation','lineAmount',n);}
function qvSummaryMoney(n){return documentMoney('quotation','summary',n);}
function qvGrandTotalMoney(n){return documentMoney('quotation','grandTotal',n);}
function pdfLineUnitMoney(n){return documentMoney('quotation','unitPrice',n);}
function pdfLineAmountMoney(n){return documentMoney('quotation','lineAmount',n);}
function pdfSummaryMoney(n){return documentMoney('quotation','summary',n);}
function pdfGrandTotalMoney(n){return documentMoney('quotation','grandTotal',n);}
function renderCurrencyDisplaySettings(){const c=ensureCurrencyDisplaySettings();currencyDisplayDraft=JSON.parse(JSON.stringify(c));document.getElementById('cdisp-line-unit').checked=!!c.showLineUnitPrice;document.getElementById('cdisp-line-amount').checked=!!c.showLineAmount;document.getElementById('cdisp-summary').checked=!!c.showSummary;document.getElementById('cdisp-grand-total').checked=!!c.showGrandTotal;document.querySelectorAll('[data-cdisp-module]').forEach(el=>el.checked=c.modules[el.dataset.cdispModule]!==false);setCurrencyDisplayDirty(false);}
function collectCurrencyDisplaySettings(){const modules={};document.querySelectorAll('[data-cdisp-module]').forEach(el=>modules[el.dataset.cdispModule]=!!el.checked);return{showLineUnitPrice:!!document.getElementById('cdisp-line-unit')?.checked,showLineAmount:!!document.getElementById('cdisp-line-amount')?.checked,showSummary:!!document.getElementById('cdisp-summary')?.checked,showGrandTotal:!!document.getElementById('cdisp-grand-total')?.checked,modules};}
function setCurrencyDisplayDirty(dirty){const st=document.getElementById('currency-display-change-status'),a=document.getElementById('currency-display-apply-btn');if(st){st.textContent=dirty?'Unsaved changes':'No pending changes';st.style.color=dirty?'var(--orange-txt)':'var(--gray)';}if(a)a.disabled=!dirty;}
function markCurrencyDisplayDirty(){setCurrencyDisplayDirty(true);}
function selectAllCurrencyDisplayModules(){document.querySelectorAll('[data-cdisp-module]').forEach(el=>el.checked=true);markCurrencyDisplayDirty();}
function restoreCurrencyDisplayDefaults(){document.getElementById('cdisp-line-unit').checked=false;document.getElementById('cdisp-line-amount').checked=false;document.getElementById('cdisp-summary').checked=true;document.getElementById('cdisp-grand-total').checked=true;document.querySelectorAll('[data-cdisp-module]').forEach(el=>el.checked=true);markCurrencyDisplayDirty();showToast('Default currency display configuration restored. Save Settings to apply.','info');}
async function applyCurrencyDisplayChanges(){settings.currencyDisplay=collectCurrencyDisplaySettings();await saveSettings();currencyDisplayDraft={...settings.currencyDisplay};setCurrencyDisplayDirty(false);showToast('Currency display settings applied.','success');const open=document.getElementById('view-modal')?.classList.contains('open');if(open&&typeof currentViewQuotationId!=='undefined'&&currentViewQuotationId)viewQuotation(currentViewQuotationId,true);}

function fmt(n) { return 'SAR '+formatNumber(n,2); }
// Round to 2 decimals to eliminate floating-point subtraction artifacts (e.g. 49.999999994 -> 50, 9.000000002 -> 9)
function roundQty(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function getUomRule(code){
  return uomMaster.find(u=>u.code.toLowerCase()===String(code||'').trim().toLowerCase()) || {code:code||'',decimals:2,step:0.01,active:true};
}
function qtyStep(uom){ return String(getUomRule(uom).step||1); }
function qtyMin(uom){ return String(getUomRule(uom).step||1); }
function roundQtyForUom(n,uom){
  const rule=getUomRule(uom),v=Number(String(n??'').replace(/,/g,''))||0,p=Math.pow(10,rule.decimals);
  return Math.round((v+Number.EPSILON)*p)/p;
}
function formatQtyForUom(n,uom){
  const rule=getUomRule(uom),v=roundQtyForUom(n,uom);
  return v.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:rule.decimals});
}
function parseBizNumber(v){ return Number(String(v??'').replace(/,/g,''))||0; }
function beginNumberEdit(el){ el.value=String(el.value||'').replace(/,/g,''); el.select?.(); }
function formatQuotePrice(el){ const v=parseBizNumber(el.value); el.value=v?v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):''; calcTotals(); }
function enforceQuoteQty(el,showMessage=false){
  const tr=el.closest('tr'),uom=tr?.querySelector('select')?.value||'',rule=getUomRule(uom),raw=parseBizNumber(el.value),rounded=roundQtyForUom(raw,uom);
  if(raw!==rounded && showMessage) showToast(`${uom} allows ${rule.decimals===0?'whole quantities only':`maximum ${rule.decimals} decimal place${rule.decimals===1?'':'s'}`}. Quantity adjusted to ${formatQtyForUom(rounded,uom)}.`,'info');
  el.value=raw?formatQtyForUom(rounded,uom):''; el.step=rule.step; el.inputMode=rule.decimals?'decimal':'numeric'; calcTotals();
}
function onQuoteUomChange(sel){ const qty=sel.closest('tr')?.querySelector('[data-quote-qty]'); if(qty) enforceQuoteQty(qty,true); markDirty('quote-modal'); }

function fmtDate(d) {
  // Convert YYYY-MM-DD to DD-MM-YYYY for display
  if (!d) return '—';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  return parts[2]+'-'+parts[1]+'-'+parts[0];
}
function fmtShort(n) { if(n>=1000000) return 'SAR '+(n/1000000).toFixed(1)+'M'; if(n>=1000) return 'SAR '+(n/1000).toFixed(0)+'K'; return fmt(n); }
const DEFAULT_TAX_SETTINGS={id:'tax-vat15',code:'VAT15',name:'Standard VAT',rate:15,effectiveFrom:'2018-01-01',effectiveTo:'',active:true,isDefault:true,remarks:''};
let currentQuoteVatRate=null;
function taxMasterId(){return 'tax-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7)}
function readTaxMaster(){
  try{
    const saved=JSON.parse(localStorage.getItem('bizcoreTaxMaster')||'null');
    if(Array.isArray(saved)&&saved.length)return saved.map(normalizeTaxRecord);
    const old=JSON.parse(localStorage.getItem('bizcoreTaxSettings')||'null');
    const seed=normalizeTaxRecord(old?{...old,id:taxMasterId(),active:true,isDefault:true}:DEFAULT_TAX_SETTINGS);
    localStorage.setItem('bizcoreTaxMaster',JSON.stringify([seed]));
    return [seed];
  }catch(_){return [{...DEFAULT_TAX_SETTINGS}]}
}
function normalizeTaxRecord(t){return {id:t.id||taxMasterId(),code:String(t.code||'VAT').trim().toUpperCase(),name:String(t.name||'VAT').trim(),rate:Math.max(0,Math.min(100,Number(t.rate)||0)),effectiveFrom:t.effectiveFrom||'',effectiveTo:t.effectiveTo||'',active:t.active!==false,isDefault:t.isDefault===true||t.default===true,remarks:t.remarks||''}}
function writeTaxMaster(rows){localStorage.setItem('bizcoreTaxMaster',JSON.stringify(rows.map(normalizeTaxRecord)))}
function taxIsEffective(t,dateValue){const d=dateValue||new Date().toISOString().slice(0,10);return (!t.effectiveFrom||t.effectiveFrom<=d)&&(!t.effectiveTo||t.effectiveTo>=d)}
function activeTaxSettings(dateValue){
  const rows=readTaxMaster();
  return rows.find(t=>t.active&&t.isDefault&&taxIsEffective(t,dateValue))||rows.find(t=>t.active&&taxIsEffective(t,dateValue))||rows.find(t=>t.isDefault)||rows[0]||{...DEFAULT_TAX_SETTINGS};
}
function readTaxSettings(){return activeTaxSettings()}
const LEGACY_QUOTATION_VAT_RATE=15;
function getQuoteVatPercent(q){
  if(q && typeof q==='object'){
    const n=Number(q.vatRate);
    return Number.isFinite(n)?n:LEGACY_QUOTATION_VAT_RATE;
  }
  return Number(activeTaxSettings().rate)||0;
}
function vatRate(q){return getQuoteVatPercent(q)/100}
function migrateQuotationVatSnapshots(){
  let changed=false;
  quotations.forEach(q=>{
    if(!Number.isFinite(Number(q.vatRate))){
      q.vatRate=LEGACY_QUOTATION_VAT_RATE;
      q.taxCode=q.taxCode||('VAT'+String(LEGACY_QUOTATION_VAT_RATE).replace(/\D/g,''));
      q.taxName=q.taxName||'Standard VAT';
      q.vatSource=q.vatSource||'Legacy Document Snapshot';
      q.vatSnapshotMigrated=true;
      changed=true;
    }
  });
  return changed;
}

function repairIncompleteQuotationDates(){
  let changed=false;
  quotations.forEach(q=>{
    if(!q || quoteDateISOFromDisplay(q.date||'')) return;
    const created=String(q.created||'').slice(0,10);
    if(/^\d{4}-\d{2}-\d{2}$/.test(created) && quoteDateISOFromDisplay(created)){
      q.date=created;
      changed=true;
    }
  });
  if(changed){
    try{localStorage.setItem('dtq_quotations',JSON.stringify(quotations));}catch(e){}
  }
  return changed;
}

function taxUsageCount(t){return (quotations||[]).filter(q=>String(q.taxCode||'').toUpperCase()===t.code.toUpperCase()).length}
function renderTaxSettings(){renderTaxMaster()}
function renderTaxMaster(){
  const rows=readTaxMaster(),body=document.getElementById('tax-master-tbody');
  const count=document.getElementById('tax-master-count'); if(count)count.textContent=`${rows.length} record${rows.length===1?'':'s'}`;
  if(!body)return;
  body.innerHTML=rows.map(t=>{const used=taxUsageCount(t),expired=!!(t.effectiveTo&&t.effectiveTo<new Date().toISOString().slice(0,10));return `<tr>
    <td><strong>${escapeHtml(t.code)}</strong></td><td>${escapeHtml(t.name)}</td><td class="right">${Number(t.rate).toFixed(2)}%</td>
    <td>${t.effectiveFrom?fmtDate(t.effectiveFrom):'—'}</td><td>${t.effectiveTo?fmtDate(t.effectiveTo):'—'}</td>
    <td class="center"><span class="badge ${t.active&&!expired?'badge-won':'badge-expired'}">${expired?'Expired':t.active?'Active':'Inactive'}</span></td>
    <td class="center">${t.isDefault?'<span class="badge badge-sent"><i class="ti ti-star-filled"></i> Default</span>':'—'}</td>
    <td class="right">${used}</td>
    <td class="center"><button class="icon-btn" title="Edit" onclick="editTaxMasterRecord('${t.id}')"><i class="ti ti-pencil"></i></button><button class="icon-btn" title="Delete" onclick="deleteTaxMasterRecord('${t.id}')" ${used?'disabled':''}><i class="ti ti-trash"></i></button></td>
  </tr>`}).join('')||'<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--gray)">No tax records</td></tr>';
}
function newTaxMasterRecord(){
  document.getElementById('tax-master-form').style.display='block';document.getElementById('tax-form-title').textContent='New tax';
  ['tax-record-id','tax-code','tax-name','tax-rate','tax-effective-from','tax-effective-to','tax-remarks'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});
  document.getElementById('tax-active').checked=true;document.getElementById('tax-default').checked=false;document.getElementById('tax-usage-count').textContent='0 quotations';hideTaxError();document.getElementById('tax-code').focus();
}
function editTaxMasterRecord(id){
  const t=readTaxMaster().find(x=>x.id===id);if(!t)return;
  document.getElementById('tax-master-form').style.display='block';document.getElementById('tax-form-title').textContent='Edit tax';
  const map={'tax-record-id':'id','tax-code':'code','tax-name':'name','tax-rate':'rate','tax-effective-from':'effectiveFrom','tax-effective-to':'effectiveTo','tax-remarks':'remarks'};Object.entries(map).forEach(([id2,k])=>document.getElementById(id2).value=t[k]??'');
  document.getElementById('tax-active').checked=t.active;document.getElementById('tax-default').checked=t.isDefault;const used=taxUsageCount(t);document.getElementById('tax-usage-count').textContent=`${used} quotation${used===1?'':'s'}`;hideTaxError();document.getElementById('tax-master-form').scrollIntoView({behavior:'smooth',block:'start'});
}
function cancelTaxMasterEdit(){const f=document.getElementById('tax-master-form');if(f)f.style.display='none';hideTaxError()}
function showTaxError(msg){const e=document.getElementById('tax-form-error');e.textContent=msg;e.style.display='block'}
function hideTaxError(){const e=document.getElementById('tax-form-error');if(e)e.style.display='none'}
function saveTaxMasterRecord(){
  hideTaxError();let rows=readTaxMaster();const id=document.getElementById('tax-record-id').value||taxMasterId();
  const rec=normalizeTaxRecord({id,code:document.getElementById('tax-code').value,name:document.getElementById('tax-name').value,rate:document.getElementById('tax-rate').value,effectiveFrom:document.getElementById('tax-effective-from').value,effectiveTo:document.getElementById('tax-effective-to').value,active:document.getElementById('tax-active').checked,isDefault:document.getElementById('tax-default').checked,remarks:document.getElementById('tax-remarks').value});
  if(!rec.code||!rec.name||document.getElementById('tax-rate').value===''||!rec.effectiveFrom)return showTaxError('Tax Code, Tax Name, VAT Rate and Effective From are required.');
  if(rec.effectiveTo&&rec.effectiveTo<rec.effectiveFrom)return showTaxError('Effective To cannot be earlier than Effective From.');
  if(rows.some(x=>x.id!==id&&x.code===rec.code))return showTaxError('Tax Code must be unique. Use a new code for a new rate or period.');
  if(rec.isDefault&&(!rec.active||!taxIsEffective(rec)))return showTaxError('The default tax must be active and effective today.');
  if(rec.isDefault)rows=rows.map(x=>({...x,isDefault:false}));
  const idx=rows.findIndex(x=>x.id===id);if(idx>=0)rows[idx]=rec;else rows.push(rec);
  if(!rows.some(x=>x.isDefault)){const candidate=rows.find(x=>x.active&&taxIsEffective(x));if(candidate)candidate.isDefault=true}
  writeTaxMaster(rows);const active=activeTaxSettings();settings.vatrate=active.rate;saveSettings?.();renderTaxMaster();cancelTaxMasterEdit();showToast('Tax Master saved. Existing quotations were not changed.','success');
}
function saveTaxSettings(){saveTaxMasterRecord()}
function deleteTaxMasterRecord(id){
  let rows=readTaxMaster();const t=rows.find(x=>x.id===id);if(!t)return;if(taxUsageCount(t)>0)return showToast('This tax code is used in documents and cannot be deleted. Mark it inactive instead.','warning');
  if(rows.length===1)return showToast('At least one tax record is required.','warning');
  const wasDefault=t.isDefault;rows=rows.filter(x=>x.id!==id);if(wasDefault){const replacement=rows.find(x=>x.active&&taxIsEffective(x))||rows[0];replacement.isDefault=true}writeTaxMaster(rows);renderTaxMaster();showToast('Tax record deleted.','success');
}

function calcQuote(q) {
  const sub = (q.items||[]).filter(i=>!i.lineType||i.lineType==='item').reduce((s,i)=>s+(parseFloat(i.qty)||0)*(parseFloat(i.up)||0),0);
  const disc = parseFloat(q.discount)||0;
  const bvat = Math.max(0,sub-disc);
  const vat = Math.round(bvat*vatRate(q)*100)/100;
  return {sub,disc,bvat,vat,net:bvat+vat};
}

function getStatusClass(s) {
  return {Draft:'badge-draft',Sent:'badge-sent',Won:'badge-won',Lost:'badge-lost',Expired:'badge-expired',Revised:'badge-revised',Cancelled:'badge-cancelled'}[s]||'badge-draft';
}

function normalizedQuotationDate(q){
  const stored=quoteDateISOFromDisplay(q?.date||'');
  if(stored) return stored;

  // Repair older/incomplete records from their creation timestamp when possible.
  const created=String(q?.created||'').slice(0,10);
  if(/^\d{4}-\d{2}-\d{2}$/.test(created) && quoteDateISOFromDisplay(created)) return created;

  return new Date().toISOString().slice(0,10);
}
function validUntil(q) {
  const iso=normalizedQuotationDate(q);
  const d=new Date(iso+'T00:00:00');
  d.setDate(d.getDate()+(parseInt(q?.validity)||7));
  return d.toISOString().split('T')[0];
}

/* ── v103 Central document numbering ── */
const DOC_NUMBERING_DEFAULTS={
  rfq:{label:'RFQ',prefix:'RFQ',reset:'monthly'},pricing:{label:'Pricing',prefix:'PR',reset:'monthly'},quotation:{label:'Quotation',prefix:'Q',reset:'monthly'},salesOrder:{label:'Sales Order',prefix:'SO',reset:'monthly'},deliveryNote:{label:'Delivery Note',prefix:'DN',reset:'monthly'},customerInvoice:{label:'Customer Invoice',prefix:'INV',reset:'monthly'},purchaseOrder:{label:'Purchase Order',prefix:'PO',reset:'monthly'},purchaseInvoice:{label:'Purchase Invoice',prefix:'PI',reset:'monthly'}
};
function ensureDocumentNumbering(){settings.documentNumbering=settings.documentNumbering||{};Object.entries(DOC_NUMBERING_DEFAULTS).forEach(([k,d])=>{settings.documentNumbering[k]={...d,...(settings.documentNumbering[k]||{})};});return settings.documentNumbering;}
function docPeriod(reset='monthly',date=new Date()){const yy=String(date.getFullYear()).slice(2),mm=String(date.getMonth()+1).padStart(2,'0');return reset==='yearly'?yy:(reset==='never'?'':yy+mm);}
function docNumberParts(type,date=new Date()){const cfg=ensureDocumentNumbering()[type]||DOC_NUMBERING_DEFAULTS[type];const period=docPeriod(cfg.reset,date);const prefix=String(cfg.prefix||DOC_NUMBERING_DEFAULTS[type]?.prefix||type.toUpperCase()).trim();const displayPrefix=prefix+(period?'-'+period:'')+'-';const counterKey='doc_'+type+'_'+(period||'all');return {cfg,period,prefix,displayPrefix,counterKey};}
function formatDocSequence(displayPrefix,n){return displayPrefix+String(Number(n)||0).padStart(4,'0');}
async function allocateDocumentNumber(type,date=new Date()){
  const x=docNumberParts(type,date);
  if(window.FB&&window.FB.getNextDocSequence&&navigator.onLine){const n=await window.FB.getNextDocSequence(x.counterKey);if(n)return formatDocSequence(x.displayPrefix,n);}
  // Offline-safe provisional ID. Never silently reuses a permanent sequence.
  return x.displayPrefix+'OFF-'+getDeviceTag()+'-'+String(Date.now()).slice(-5);
}
function existingDocumentNumbers(type){
  if(type==='rfq')return rfqs.map(x=>x.rfqNo||''); if(type==='quotation')return quotations.map(x=>x.qno||''); if(type==='salesOrder')return salesOrders.map(x=>x.soNo||'');
  if(type==='deliveryNote')return salesOrders.flatMap(s=>(s.deliveries||[]).map(x=>x.dnNo||'')); if(type==='customerInvoice')return salesOrders.flatMap(s=>(s.invoices||[]).map(x=>x.invNo||'')); return [];
}
function estimatedNextDocumentNumber(type){const x=docNumberParts(type);const vals=existingDocumentNumbers(type).filter(n=>String(n).startsWith(x.displayPrefix)&&!String(n).includes('-OFF-')).map(n=>parseInt(String(n).slice(x.displayPrefix.length),10)||0);return formatDocSequence(x.displayPrefix,(vals.length?Math.max(...vals):0)+1);}
function renderDocumentNumbering(){
  ensureDocumentNumbering();
  const body=document.getElementById('document-numbering-tbody');if(!body)return;
  body.innerHTML=Object.entries(DOC_NUMBERING_DEFAULTS).map(([k,d])=>{const c=settings.documentNumbering[k];const fmt=c.reset==='monthly'?`${c.prefix}-YYMM-####`:c.reset==='yearly'?`${c.prefix}-YY-####`:`${c.prefix}-####`;return `<tr><td><strong>${d.label}</strong></td><td><input class="docnum-prefix" data-type="${k}" value="${c.prefix}" maxlength="8" oninput="previewDocumentNumbering()"></td><td><select class="docnum-reset" data-type="${k}" onchange="previewDocumentNumbering()"><option value="monthly" ${c.reset==='monthly'?'selected':''}>Monthly</option><option value="yearly" ${c.reset==='yearly'?'selected':''}>Yearly</option><option value="never" ${c.reset==='never'?'selected':''}>Never</option></select></td><td><span class="docnum-format-preview" data-format-type="${k}">${fmt}</span></td><td><span class="docnum-next"><strong data-next-type="${k}">${estimatedNextDocumentNumber(k)}</strong><small>Allocated atomically on Save</small></span></td></tr>`}).join('');
  populateSequenceDocumentTypes();
}
function previewDocumentNumbering(){document.querySelectorAll('.docnum-prefix').forEach(inp=>{const k=inp.dataset.type,reset=document.querySelector(`.docnum-reset[data-type="${k}"]`)?.value||'monthly',prefix=(inp.value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'')||DOC_NUMBERING_DEFAULTS[k].prefix),fmt=reset==='monthly'?`${prefix}-YYMM-####`:reset==='yearly'?`${prefix}-YY-####`:`${prefix}-####`;const f=document.querySelector(`[data-format-type="${k}"]`);if(f)f.textContent=fmt;});}
async function saveDocumentNumbering(){ensureDocumentNumbering();document.querySelectorAll('.docnum-prefix').forEach(e=>{const v=e.value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');if(v)settings.documentNumbering[e.dataset.type].prefix=v;});document.querySelectorAll('.docnum-reset').forEach(e=>settings.documentNumbering[e.dataset.type].reset=e.value);await saveSettings();renderDocumentNumbering();showToast('Document numbering settings saved','success');}
function switchNumberingSection(name){['numbering','defaults','sequences'].forEach(k=>{const s=document.getElementById('numbering-section-'+k),b=document.getElementById('numtab-'+k);if(s)s.style.display=k===name?'block':'none';if(b)b.classList.toggle('active',k===name);});if(name==='sequences')refreshSequenceManager();}
function populateSequenceDocumentTypes(){const sel=document.getElementById('sequence-doc-type');if(!sel)return;const current=sel.value;sel.innerHTML=Object.entries(DOC_NUMBERING_DEFAULTS).map(([k,d])=>`<option value="${k}">${d.label}</option>`).join('');if(current&&DOC_NUMBERING_DEFAULTS[current])sel.value=current;refreshSequenceManager();}
function maxExistingSequence(type){const x=docNumberParts(type);const vals=existingDocumentNumbers(type).filter(n=>String(n).startsWith(x.displayPrefix)&&!String(n).includes('-OFF-')).map(n=>parseInt(String(n).slice(x.displayPrefix.length),10)||0);return vals.length?Math.max(...vals):0;}
async function refreshSequenceManager(){const sel=document.getElementById('sequence-doc-type');if(!sel)return;const type=sel.value||'rfq',x=docNumberParts(type),localMax=maxExistingSequence(type);let current=localMax;if(window.FB?.getDocSequence&&navigator.onLine){const cloud=await window.FB.getDocSequence(x.counterKey);if(Number.isFinite(Number(cloud)))current=Math.max(current,Number(cloud));}const period=document.getElementById('sequence-current-period'),counter=document.getElementById('sequence-current-counter'),next=document.getElementById('sequence-next-number'),input=document.getElementById('sequence-adjust-value');if(period)period.textContent=x.period||(x.cfg.reset==='never'?'Continuous':'—');if(counter)counter.textContent=String(current).padStart(4,'0');if(next)next.textContent=formatDocSequence(x.displayPrefix,current+1);if(input)input.value=current;}
async function requestSequenceAdjustment(){const type=document.getElementById('sequence-doc-type')?.value||'rfq',value=Number(document.getElementById('sequence-adjust-value')?.value);if(!Number.isInteger(value)||value<0){showToast('Enter a valid whole-number counter','error');return;}const x=docNumberParts(type),min=maxExistingSequence(type),label=DOC_NUMBERING_DEFAULTS[type].label;if(value<min){showToast(`Counter cannot be below ${String(min).padStart(4,'0')} because that sequence already exists`,'error');return;}if(!navigator.onLine||!window.FB?.setDocSequence){showToast('Cloud connection is required to adjust a document sequence','error');return;}const first=await showConfirmAsync({icon:'⚠️',title:'Adjust document sequence?',message:`Change the current ${label} counter for this period?`,details:{Document:label,'Current period':x.period||'Continuous','New current counter':String(value).padStart(4,'0'),'Next document':formatDocSequence(x.displayPrefix,value+1)},confirmText:'Continue',cancelText:'Cancel',confirmClass:'btn-danger'});if(!first)return;const second=await showConfirmAsync({icon:'🔒',title:'Final confirmation',message:'This changes the live cloud counter used for future document numbers. Existing issued documents will not be renumbered.',details:{Document:label,'Counter will become':String(value).padStart(4,'0')},confirmText:'Yes, adjust sequence',cancelText:'Go back',confirmClass:'btn-danger'});if(!second)return;const result=await window.FB.setDocSequence(x.counterKey,value,min);if(result?.ok){showToast(`${label} sequence updated`,'success');await refreshSequenceManager();renderDocumentNumbering();}else showToast(result?.message||'Could not update document sequence','error');}

/* ── Quotation numbering ──
   Online: uses Firestore atomic counter — guarantees no two users
           (even saving in the same second) ever get the same number.
   Offline: falls back to a device-tagged number so it never collides
            with another offline user's number, then gets renumbered
            to a proper sequential number once back online. ── */
function nextQNo() {
  // Synchronous fallback used only while the async atomic version
  // is being fetched, or if the device is offline.
  const t=new Date();
  const prefix='Q-'+String(t.getFullYear()).slice(2)+String(t.getMonth()+1).padStart(2,'0')+'-';
  const nums=quotations.filter(q=>String(q?.qno||'').startsWith(prefix)).map(q=>parseInt(String(q.qno).split('-').pop())||0);
  return prefix+((nums.length?Math.max(...nums):3960)+1);
}

/* ── Reserve the real atomic number into an open form field ──
   Called right after a placeholder number is shown, so the user
   sees a number immediately but the FINAL saved number is always
   collision-safe. If the field's value hasn't been touched by the
   user by the time the real number arrives, it's swapped in. ── */
async function reserveQNoForForm(fieldId) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  const placeholderShown = field.value;

  const result = await nextQNoSafe();

  // Only swap if the user hasn't manually edited the ref field themselves
  // and the modal is still open with the same placeholder showing
  if (field && field.value === placeholderShown) {
    field.value = result.qno;
    field.dataset.reservedQno = result.qno;
    field.dataset.isProvisional = result.isProvisional ? '1' : '0';
    if (result.isProvisional) {
      showToast('Offline — this quotation will get its final number once you\'re back online', 'error');
    }
  }
}

/* ── Async, collision-safe version — use this when creating NEW documents ── */
async function nextQNoSafe() {
  const t=new Date();
  const x=docNumberParts('quotation',t);
  if(window.FB&&window.FB.getNextDocSequence&&navigator.onLine){
    const n=await window.FB.getNextDocSequence(x.counterKey);
    if(n)return {qno:formatDocSequence(x.displayPrefix,n),isProvisional:false};
  }
  const deviceTag=getDeviceTag();
  return {qno:x.displayPrefix+'OFF-'+deviceTag+'-'+String(Date.now()).slice(-5),isProvisional:true};
}

/* ── Small stable per-device identifier (persisted in localStorage) ──
   Used only to keep offline-generated numbers from colliding with
   another offline device's numbers. Not shown to the customer unless
   the document is still provisional at print time. ── */
function getDeviceTag() {
  let tag = localStorage.getItem('bc_device_tag');
  if (!tag) {
    tag = Math.random().toString(36).slice(2, 6);
    localStorage.setItem('bc_device_tag', tag);
  }
  return tag;
}

/* ── Renumber provisional (offline-created) quotations once back online ──
   Call this after reconnecting — finds any "OFF-" tagged quotations
   this device created and assigns them a real sequential number. ── */
async function renumberProvisionalQuotations() {
  if (!navigator.onLine || !window.FB || !window.FB.getNextDocNumber) return;
  const provisional = quotations.filter(q => q.qno && q.qno.includes('-OFF-'));
  if (!provisional.length) return;

  console.log('Renumbering ' + provisional.length + ' offline-created quotation(s)...');
  for (const q of provisional) {
    const t = new Date(q.date || q.created || Date.now());
    const x=docNumberParts('quotation',t);
    const seq = await window.FB.getNextDocSequence(x.counterKey);
    const realNo = seq ? formatDocSequence(x.displayPrefix,seq) : null;
    if (realNo) {
      const oldQno = q.qno;
      q.qno = realNo;
      console.log('Renumbered ' + oldQno + ' → ' + realNo);
    }
  }
  await saveQuotations();
  renderAll();
  showToast(provisional.length + ' offline quotation(s) assigned final numbers', 'success');
}

// Run renumbering automatically whenever the app comes back online
window.addEventListener('online', function() {
  setTimeout(renumberProvisionalQuotations, 3000); // small delay to let sync settle first
});

/* ── RENDER ALL ── */
function setDatePreset(preset) {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  let from, to;
  if (preset === 'thismonth') {
    from = new Date(y, m, 1);
    to   = new Date(y, m+1, 0);
  } else if (preset === 'lastmonth') {
    from = new Date(y, m-1, 1);
    to   = new Date(y, m, 0);
  } else if (preset === 'last3') {
    from = new Date(y, m-2, 1);
    to   = new Date(y, m+1, 0);
  }
  document.getElementById('filter-date-from').value = fmt(from);
  document.getElementById('filter-date-to').value   = fmt(to);
  renderTable();
}

function clearDateFilter() {
  document.getElementById('filter-date-from').value = '';
  document.getElementById('filter-date-to').value   = '';
  document.getElementById('date-clear-btn').style.display = 'none';
  renderTable();
}

/* ── DEFAULT TERMS ── */
function getDefaultDeliveryTerms() {
  return [
    {id:'dt1', text:'Ex-stock (immediate delivery)',   isDefault:false},
    {id:'dt2', text:'1 week from confirmed PO',        isDefault:false},
    {id:'dt3', text:'2–4 weeks from confirmed PO',     isDefault:true},
    {id:'dt4', text:'4–6 weeks from confirmed PO',     isDefault:false},
    {id:'dt5', text:'6–8 weeks from confirmed PO',     isDefault:false},
    {id:'dt6', text:'8–12 weeks from confirmed PO',    isDefault:false},
    {id:'dt7', text:'Subject to availability',         isDefault:false},
    {id:'dt8', text:'To be confirmed upon order',      isDefault:false},
  ];
}
function getDefaultPaymentTerms() {
  return [
    {id:'pt1', text:'Cash on delivery',                isDefault:false},
    {id:'pt2', text:'100% advance payment',            isDefault:false},
    {id:'pt3', text:'50% advance, 50% on delivery',   isDefault:false},
    {id:'pt4', text:'Net 2 weeks from invoice date',   isDefault:true},
    {id:'pt5', text:'Net 30 days from invoice date',   isDefault:false},
    {id:'pt6', text:'Net 45 days from invoice date',   isDefault:false},
    {id:'pt7', text:'Net 60 days from invoice date',   isDefault:false},
    {id:'pt8', text:'Letter of credit (LC)',           isDefault:false},
  ];
}

function getDefaultTerm(list) {
  return (list.find(t=>t.isDefault) || list[0])?.text || '';
}

/* ── TERMS DROPDOWN IN QUOTATION FORM ── */
function populateTermsSelect(type) {
  const list  = type === 'delivery' ? deliveryTerms : paymentTerms;
  const selId = type === 'delivery' ? 'f-delivery' : 'f-payment';
  const sel   = document.getElementById(selId);
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML =
    list.map(t => `<option value="${t.text}" ${t.text===cur?'selected':''}>${t.text}${t.isDefault?' ★':''}</option>`).join('') +
    '<option value="__add__">＋ Add new term…</option>';
  // If no value yet, set default
  if (!cur || cur === '__add__') {
    const def = getDefaultTerm(list);
    if (def) sel.value = def;
  }
}

function onTermsChange(type) {
  const selId = type === 'delivery' ? 'f-delivery' : 'f-payment';
  const addId = type === 'delivery' ? 'f-delivery-add' : 'f-payment-add';
  const newId = type === 'delivery' ? 'f-delivery-new' : 'f-payment-new';
  const sel   = document.getElementById(selId);
  if (sel.value === '__add__') {
    document.getElementById(addId).classList.add('open');
    setTimeout(() => document.getElementById(newId).focus(), 50);
  } else {
    document.getElementById(addId).classList.remove('open');
  }
}

async function saveNewTerm(type) {
  const newId = type === 'delivery' ? 'f-delivery-new' : 'f-payment-new';
  const addId = type === 'delivery' ? 'f-delivery-add' : 'f-payment-add';
  const val   = document.getElementById(newId).value.trim();
  if (!val) return;
  const list  = type === 'delivery' ? deliveryTerms : paymentTerms;
  // Avoid duplicates
  if (!list.some(t => t.text.toLowerCase() === val.toLowerCase())) {
    list.push({id: 't'+Date.now().toString(36), text: val, isDefault: false});
    if (type === 'delivery') deliveryTerms = list;
    else paymentTerms = list;
    await saveTerms();
  }
  document.getElementById(newId).value = '';
  document.getElementById(addId).classList.remove('open');
  populateTermsSelect(type);
  // Select the new term
  const selId = type === 'delivery' ? 'f-delivery' : 'f-payment';
  document.getElementById(selId).value = val;
  renderSetupTermsList(type);
  showToast('Term added','success');
}

function cancelNewTerm(type) {
  const addId = type === 'delivery' ? 'f-delivery-add' : 'f-payment-add';
  const newId = type === 'delivery' ? 'f-delivery-new' : 'f-payment-new';
  const selId = type === 'delivery' ? 'f-delivery' : 'f-payment';
  document.getElementById(addId).classList.remove('open');
  document.getElementById(newId).value = '';
  // Restore previous valid selection
  const list = type === 'delivery' ? deliveryTerms : paymentTerms;
  const def  = getDefaultTerm(list);
  document.getElementById(selId).value = def;
}

/* ── TERMS LISTS IN SETUP ── */
function renderSetupTermsList(type) {
  const list    = type === 'delivery' ? deliveryTerms : paymentTerms;
  const listId  = `setup-${type}-list`;
  const el      = document.getElementById(listId);
  if (!el) return;
  el.innerHTML  = list.map((t,i) => `
    <div class="terms-list-item ${t.isDefault?'is-default':''}" data-id="${t.id}">
      <span class="term-text">${t.text}</span>
      ${t.isDefault ? '<span class="terms-default-badge">Default</span>' :
        `<button onclick="setDefaultTerm('${type}','${t.id}')" style="font-size:10px;background:none;border:1px solid var(--border);border-radius:4px;padding:2px 7px;cursor:pointer;color:var(--gray);white-space:nowrap">Set default</button>`}
      <button onclick="deleteTerm('${type}','${t.id}')" style="background:none;border:none;cursor:pointer;color:var(--red);font-size:14px;padding:2px 4px"><i class="ti ti-trash"></i></button>
    </div>`).join('') || '<div style="padding:12px;font-size:12px;color:var(--gray);text-align:center">No terms yet — add one below</div>';
}

async function addSetupTerm(type) {
  const inputId = `setup-${type}-new`;
  const val     = document.getElementById(inputId).value.trim();
  if (!val) return;
  const list    = type === 'delivery' ? deliveryTerms : paymentTerms;
  if (!list.some(t => t.text.toLowerCase() === val.toLowerCase())) {
    list.push({id:'t'+Date.now().toString(36), text:val, isDefault:false});
    await saveTerms();
    populateTermsSelect(type);
  }
  document.getElementById(inputId).value = '';
  renderSetupTermsList(type);
  showToast('Term added','success');
}

async function setDefaultTerm(type, id) {
  const list = type === 'delivery' ? deliveryTerms : paymentTerms;
  list.forEach(t => t.isDefault = (t.id === id));
  await saveTerms();
  renderSetupTermsList(type);
  populateTermsSelect(type);
  showToast('Default term updated','success');
}

async function deleteTerm(type, id) {
  if (type === 'delivery') deliveryTerms = deliveryTerms.filter(t=>t.id!==id);
  else paymentTerms = paymentTerms.filter(t=>t.id!==id);
  await saveTerms();
  renderSetupTermsList(type);
  populateTermsSelect(type);
}

/* ── DEFAULT PRODUCTS ── */
function getDefaultProducts() {
  return [
    {id:'p001',code:'PP-A4-500',name:'Roco Printing Paper A4',brand:'Roco',model:'A4-500',category:'Stationery',uom:'Box',price:79,specs:[{k:'Size',v:'A4'},{k:'Weight',v:'80gsm'},{k:'Reams/Box',v:'5'}],notes:'500 pcs per ream, 5 reams per box'},
    {id:'p002',code:'PP-A3-500',name:'Roco Printing Paper A3',brand:'Roco',model:'A3-500',category:'Stationery',uom:'Box',price:163,specs:[{k:'Size',v:'A3'},{k:'Weight',v:'80gsm'},{k:'Reams/Box',v:'5'}],notes:''},
    {id:'p003',code:'TNR-HP26A',name:'HP LaserJet 26A Toner Cartridge',brand:'HP',model:'CF226A',category:'Stationery',uom:'Pcs',price:615,specs:[{k:'Color',v:'Black'},{k:'Yield',v:'~3,100 pages'}],notes:''},
    {id:'p004',code:'IKL-32W-SIL',name:'Insect Killer Light 32W Round',brand:'Sylvania',model:'SYL-IKL-32W',category:'Electrical',uom:'Pcs',price:69,specs:[{k:'Power',v:'32W'},{k:'Shape',v:'Round'},{k:'Voltage',v:'220V'}],notes:''},
    {id:'p005',code:'AHU-PUL-SPB212',name:'AHU Pulley SPB 212',brand:'',model:'SPB 212',category:'Mechanical',uom:'Pcs',price:435,specs:[{k:'Type',v:'SPB'},{k:'Size',v:'212mm'}],notes:''},
    {id:'p006',code:'VBELT-SPB1500',name:'V Belt SPB 1500',brand:'',model:'SPB 1500',category:'Mechanical',uom:'Pcs',price:56,specs:[{k:'Type',v:'SPB'},{k:'Length',v:'1500mm'}],notes:''},
    {id:'p007',code:'FB-1200',name:'Fire Blanket 1.2m x 1.2m',brand:'',model:'',category:'Safety',uom:'EA',price:32,specs:[{k:'Size',v:'1.2m x 1.2m'},{k:'Material',v:'Fibreglass'}],notes:''},
    {id:'p008',code:'HELM-STD',name:'Safety Helmet Standard',brand:'',model:'',category:'Safety',uom:'Pcs',price:45,specs:[{k:'Standard',v:'EN397'},{k:'Color',v:'White'}],notes:''},
    {id:'p009',code:'SHOE-SAF',name:'Safety Shoes',brand:'',model:'',category:'Safety',uom:'Pair',price:120,specs:[{k:'Standard',v:'ISO 20345'},{k:'Toe',v:'Steel'}],notes:''},
    {id:'p010',code:'NCAFE-190G',name:'Nescafé Gold 190g',brand:'Nescafé',model:'Gold 190g',category:'Other',uom:'Pcs',price:39,specs:[{k:'Weight',v:'190g'}],notes:''},
  ];
}

/* ── MASTER DATA SELECTION / SAFE DELETE ── */
const masterSelection = {
  customers: new Set(),
  suppliers: new Set(),
  products: new Set(),
};
const masterVisiblePageIds = { customers: [], suppliers: [], products: [] };

function masterCollection(type) {
  if (type === 'customers') return customers;
  if (type === 'suppliers') return suppliers;
  if (type === 'products') return products;
  return [];
}
function masterRecordLabel(type, rec) {
  if (!rec) return 'Record';
  if (type === 'customers' || type === 'suppliers') return rec.company || 'Record';
  return rec.name || rec.code || 'Product';
}
function normalizeMasterValue(v) { return String(v || '').trim().toLowerCase(); }

// v102 relationship standard: master IDs are the relationship keys; names are display snapshots only.
function findUniqueMasterByName(list, name){
  const n=normalizeMasterValue(name); if(!n) return null;
  const matches=(list||[]).filter(x=>normalizeMasterValue(x.company)===n);
  return matches.length===1 ? matches[0] : null;
}
function recordBelongsToCustomer(rec, customer, nameField='company'){
  if(!rec||!customer)return false;
  if(rec.custId) return String(rec.custId)===String(customer.id);
  return normalizeMasterValue(rec[nameField])===normalizeMasterValue(customer.company);
}
function recordBelongsToSupplier(rec, supplier, nameField='supplierName'){
  if(!rec||!supplier)return false;
  if(rec.supplierId) return String(rec.supplierId)===String(supplier.id);
  return normalizeMasterValue(rec[nameField])===normalizeMasterValue(supplier.company);
}
function supplierRefMatches(obj, supplier){
  if(!obj||!supplier)return false;
  if(obj.supplierId) return String(obj.supplierId)===String(supplier.id);
  return normalizeMasterValue(obj.supplierName||obj.supplier)===normalizeMasterValue(supplier.company);
}
function migrateMasterRelationshipIds(){
  const changed={quotations:false,rfqs:false,salesOrders:false};
  quotations.forEach(q=>{
    if(!q.custId){const c=findUniqueMasterByName(customers,q.company);if(c){q.custId=c.id;changed.quotations=true;}}
  });
  rfqs.forEach(r=>{
    if(!r.custId){const c=findUniqueMasterByName(customers,r.company);if(c){r.custId=c.id;changed.rfqs=true;}}
    if(!r.supplierId){const sp=findUniqueMasterByName(suppliers,r.supplierName);if(sp){r.supplierId=sp.id;changed.rfqs=true;}}
    const stampSupplier=(obj)=>{if(!obj)return;if(!obj.supplierId){const sp=findUniqueMasterByName(suppliers,obj.supplierName||obj.supplier);if(sp){obj.supplierId=sp.id;changed.rfqs=true;}}};
    (r.pricingItems||[]).forEach(stampSupplier);
    (r.vendorQuotes||[]).forEach(stampSupplier);
    (r.pricingVersions||[]).forEach(v=>{stampSupplier(v);(v.pricingItems||[]).forEach(stampSupplier);(v.vendorQuotes||[]).forEach(stampSupplier);});
  });
  salesOrders.forEach(so=>{
    if(!so.custId){
      const q=quotations.find(q=>q.id===so.quotationId);
      const c=(q?.custId&&customers.find(x=>String(x.id)===String(q.custId)))||findUniqueMasterByName(customers,so.customer);
      if(c){so.custId=c.id;changed.salesOrders=true;}
    }
  });
  return changed;
}

function toggleMasterSelection(type, id, checked) {
  const set = masterSelection[type]; if (!set) return;
  if (checked) set.add(id); else set.delete(id);
  updateMasterSelectionUI(type);
  const row = document.querySelector(`tr[data-master-type="${type}"][data-master-id="${CSS.escape(id)}"]`);
  if (row) row.classList.toggle('master-row-selected', checked);
}
function toggleMasterPageSelection(type, checked) {
  const set = masterSelection[type]; if (!set) return;
  (masterVisiblePageIds[type] || []).forEach(id => checked ? set.add(id) : set.delete(id));
  if (type === 'customers') renderCustomers();
  else if (type === 'suppliers') renderSuppliers();
  else if (type === 'products') renderProducts();
}
function updateMasterSelectionUI(type) {
  const set = masterSelection[type]; if (!set) return;
  // Remove stale IDs if records were restored/deleted elsewhere.
  const validIds = new Set(masterCollection(type).map(x => x.id));
  [...set].forEach(id => { if (!validIds.has(id)) set.delete(id); });
  const count = set.size;
  const btn = document.getElementById(type + '-delete-selected');
  const countEl = document.getElementById(type + '-selected-count');
  if (btn) btn.disabled = count === 0;
  if (countEl) countEl.textContent = count ? `(${count})` : '';
  const all = document.getElementById(type + '-select-all');
  const visible = masterVisiblePageIds[type] || [];
  if (all) {
    const selectedVisible = visible.filter(id => set.has(id)).length;
    all.checked = visible.length > 0 && selectedVisible === visible.length;
    all.indeterminate = selectedVisible > 0 && selectedVisible < visible.length;
  }
}

function getMasterDependencies(type, rec) {
  if (!rec) return [];
  const deps = [];
  const id = rec.id;
  if (type === 'customers') {
    const name = normalizeMasterValue(rec.company);
    const customer=customers.find(c=>String(c.id)===String(id));
    const qCount = quotations.filter(q => customer && recordBelongsToCustomer(q,customer,'company')).length;
    const rCount = rfqs.filter(r => customer && recordBelongsToCustomer(r,customer,'company')).length;
    const soCount = salesOrders.filter(so => customer && recordBelongsToCustomer(so,customer,'customer')).length;
    if (qCount) deps.push(`${qCount} quotation${qCount===1?'':'s'}`);
    if (rCount) deps.push(`${rCount} RFQ${rCount===1?'':'s'}`);
    if (soCount) deps.push(`${soCount} sales order${soCount===1?'':'s'}`);
  } else if (type === 'suppliers') {
    const name = normalizeMasterValue(rec.company);
    let rfqCount = 0;
    rfqs.forEach(r => {
      let used = recordBelongsToSupplier(r,rec);
      if (!used) used = (r.pricingItems || []).some(it => supplierRefMatches(it,rec));
      if (!used) used = (r.vendorQuotes || []).some(v => supplierRefMatches(v,rec));
      if (!used) used = (r.pricingVersions || []).some(v =>
        supplierRefMatches(v,rec) ||
        (v.pricingItems || []).some(it => supplierRefMatches(it,rec)) ||
        (v.vendorQuotes || []).some(q => supplierRefMatches(q,rec))
      );
      if (used) rfqCount++;
    });
    if (rfqCount) deps.push(`${rfqCount} RFQ/pricing document${rfqCount===1?'':'s'}`);
  } else if (type === 'products') {
    const code = normalizeMasterValue(rec.code);
    const name = normalizeMasterValue(rec.name);
    const itemUsesProduct = it => !!it && (
      it.prodId === id || it.productId === id || it.itemId === id ||
      (code && normalizeMasterValue(it.code) === code) ||
      (!code && name && normalizeMasterValue(it.desc || it.name) === name)
    );
    const qCount = quotations.filter(q => (q.items || []).some(itemUsesProduct)).length;
    const rCount = rfqs.filter(r =>
      (r.items || []).some(itemUsesProduct) ||
      (r.pricingItems || []).some(itemUsesProduct) ||
      (r.pricingVersions || []).some(v => (v.pricingItems || []).some(itemUsesProduct))
    ).length;
    const soCount = salesOrders.filter(so => (so.items || []).some(itemUsesProduct)).length;
    if (qCount) deps.push(`${qCount} quotation${qCount===1?'':'s'}`);
    if (rCount) deps.push(`${rCount} RFQ/pricing document${rCount===1?'':'s'}`);
    if (soCount) deps.push(`${soCount} sales order${soCount===1?'':'s'}`);
  }
  return deps;
}

function showMasterDeleteBlocked(type, blocked) {
  const typeName = type === 'customers' ? 'customer' : type === 'suppliers' ? 'supplier' : 'product';
  const lines = blocked.slice(0,6).map(x => `• ${masterRecordLabel(type,x.record)} — ${x.dependencies.join(', ')}`);
  if (blocked.length > 6) lines.push(`• and ${blocked.length-6} more`);
  showValidationDialog(
    'Delete Not Allowed',
    `The selected ${typeName}${blocked.length>1?' records are':' is'} connected to existing data and cannot be deleted.\n\n${lines.join('\n')}\n\nThis master record must remain while those business documents exist.`,
    '', ''
  );
}

async function requestMasterDelete(type, ids, sourceModalId='') {
  const records = [...new Set((ids || []).filter(Boolean))].map(id => masterCollection(type).find(x => x.id === id)).filter(Boolean);
  if (!records.length) return false;
  const blocked = records.map(record => ({record, dependencies:getMasterDependencies(type, record)})).filter(x => x.dependencies.length);
  if (blocked.length) { showMasterDeleteBlocked(type, blocked); return false; }

  const singular = type === 'customers' ? 'customer' : type === 'suppliers' ? 'supplier' : 'product';
  const label = records.length === 1 ? masterRecordLabel(type, records[0]) : `${records.length} ${singular}s`;
  const first = await showConfirmAsync({
    icon:'🗑️',
    title:`Move ${label} to Recycle Bin?`,
    message:`${records.length===1?'This record':'These records'} will be removed from active Master Data and moved to the Recycle Bin. ${records.length===1?'It can':'They can'} be restored later.`,
    confirmText:'Continue'
  });
  if (!first) return false;
  const second = await showConfirmAsync({
    icon:'⚠️',
    title:'Final confirmation',
    message:`This is the second confirmation. Move ${label} to the Recycle Bin now?`,
    confirmText:'Move to Recycle Bin'
  });
  if (!second) return false;

  const now = new Date().toISOString();
  const deletedBy = (window.currentUser && (window.currentUser.email || window.currentUser.name)) || 'unknown';
  records.forEach(record => recycleBin.push({...record, deletedAt:now, deletedBy, originalCollection:type}));
  const idsSet = new Set(records.map(r=>r.id));
  if (type === 'customers') customers = customers.filter(r=>!idsSet.has(r.id));
  else if (type === 'suppliers') suppliers = suppliers.filter(r=>!idsSet.has(r.id));
  else if (type === 'products') products = products.filter(r=>!idsSet.has(r.id));
  records.forEach(r => masterSelection[type].delete(r.id));

  const saveFn = type === 'customers' ? saveCustomers : type === 'suppliers' ? saveSuppliers : saveProducts;
  await Promise.all([saveFn(), saveRecycleBin()]);
  if (sourceModalId) { clearDirty(); closeModal(sourceModalId); }
  if (type === 'customers') { renderCustomers(); renderSetupCustTable(); }
  else if (type === 'suppliers') renderSuppliers();
  else if (type === 'products') renderProducts();
  showToast(`${label} moved to Recycle Bin`, 'success');
  return true;
}

function deleteSelectedMasterRecords(type) {
  return requestMasterDelete(type, [...(masterSelection[type] || [])]);
}

/* ── GLOBAL REGISTER HEADER SORTING (v101) ── */
const registerSortState = {};
function naturalSortValue(v){
  if(v===null||v===undefined)return '';
  if(v instanceof Date)return v.getTime();
  if(typeof v==='number')return Number.isFinite(v)?v:0;
  const str=String(v).trim();
  if(/^\d{4}-\d{2}-\d{2}/.test(str)){const t=Date.parse(str);if(!Number.isNaN(t))return t;}
  return str;
}
function compareRegisterValues(a,b){
  a=naturalSortValue(a); b=naturalSortValue(b);
  if(typeof a==='number'&&typeof b==='number')return a-b;
  return String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'});
}
function sortRegisterRows(rows, screen, getters){
  const st=registerSortState[screen]; if(!st||!getters[st.key])return rows;
  return [...rows].sort((a,b)=>compareRegisterValues(getters[st.key](a),getters[st.key](b))*(st.dir==='asc'?1:-1));
}
function setRegisterSort(screen,key,renderFn){
  const cur=registerSortState[screen];
  registerSortState[screen]={key,dir:(cur&&cur.key===key&&cur.dir==='asc')?'desc':'asc'};
  try{ if(screen==='quotation') currentPage=1; if(screen==='pricing') pricingDocPage=1; if(screen==='rfq') rfqPage=1; if(screen==='so') soPage=1; if(screen==='customers') customerPage=1; if(screen==='suppliers') supplierPage=1; if(screen==='products') prodPage=1; if(screen==='employees') employeePage=1; }catch(e){}
  renderFn();
  setTimeout(updateRegisterSortIndicators,0);
}
function updateRegisterSortIndicators(){
  document.querySelectorAll('.sortable-register-th').forEach(th=>{const st=registerSortState[th.dataset.sortScreen];const active=st&&st.key===th.dataset.sortKey;th.classList.toggle('is-sorted',!!active);th.setAttribute('data-sort-dir',active?st.dir:'');th.setAttribute('aria-sort',active?(st.dir==='asc'?'ascending':'descending'):'none');});
}
function registerSortLabel(screen,key,label){
  const st=registerSortState[screen];
  const arrow=st&&st.key===key?(st.dir==='asc'?' ↑':' ↓'):'';
  return `${label}<span class="register-sort-arrow">${arrow}</span>`;
}

/* ── PRODUCT CRUD ── */
function renderProducts() {
  document.querySelectorAll('.rows-per-page-select').forEach(el=>{ if(el.value!=String(PROD_PER_PAGE)) el.value = String(PROD_PER_PAGE); });
  const search = (document.getElementById('prod-search-filter')?.value||'').toLowerCase();
  const cat    = document.getElementById('prod-cat-filter')?.value||'';
  let list = products.filter(p => {
    if (cat && p.category !== cat) return false;
    if (search && !`${p.name} ${p.brand} ${p.model} ${p.code}`.toLowerCase().includes(search)) return false;
    return true;
  });
  list=sortRegisterRows(list,'products',{code:p=>p.code,name:p=>p.name,brand:p=>p.brand,model:p=>p.model,category:p=>p.category,uom:p=>p.uom,price:p=>parseFloat(p.price)||0,specs:p=>(p.specs||[]).map(x=>`${x.k} ${x.v}`).join(' ')});
  const pages = Math.ceil(list.length / PROD_PER_PAGE) || 1;
  if (prodPage > pages) prodPage = 1;
  const slice = list.slice((prodPage-1)*PROD_PER_PAGE, prodPage*PROD_PER_PAGE);
  masterVisiblePageIds.products = slice.map(p=>p.id);
  const tbody = document.getElementById('products-tbody');
  if (!tbody) return;
  tbody.innerHTML = slice.length ? slice.map(p => {
    const selected = masterSelection.products.has(p.id);
    const specStr = (p.specs||[]).map(s=>`${s.k}: ${s.v}`).join(' · ');
    const imgHtml = p.image
      ? `<img src="${p.image}" style="width:40px;height:40px;object-fit:contain;border-radius:4px;border:1px solid var(--border)">`
      : `<div style="width:40px;height:40px;background:var(--blue-pale);border-radius:4px;display:flex;align-items:center;justify-content:center"><i class="ti ti-package" style="font-size:18px;color:var(--blue-light)"></i></div>`;
    return `<tr class="master-clickable-row${selected?' master-row-selected':''}" data-master-type="products" data-master-id="${p.id}" tabindex="0" role="button" aria-label="Open product ${p.name}" onclick="viewProduct('${p.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();viewProduct('${p.id}');}">
      <td class="master-select-col" onclick="event.stopPropagation()"><input class="master-row-check" type="checkbox" ${selected?'checked':''} onkeydown="event.stopPropagation()" aria-label="Select ${p.name}" onchange="toggleMasterSelection('products','${p.id}',this.checked)"></td>
      <td>${imgHtml}</td>
      <td style="font-weight:500;color:var(--gray)">${p.code||'—'}</td>
      <td><strong>${p.name}</strong></td>
      <td>${p.brand||'—'}</td>
      <td>${p.model||'—'}</td>
      <td>${p.category||'—'}</td>
      <td>${p.uom}</td>
      <td class="right" style="font-weight:600">${p.price>0?fmt(p.price):'—'}</td>
      <td style="font-size:11px;color:var(--gray);max-width:180px">${specStr||'—'}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="10"><div class="empty-state"><i class="ti ti-package-off"></i><strong>No products found</strong><p>Add products to the database to use them in quotations.</p></div></td></tr>`;

  const pp = document.getElementById('prod-pagination');
  if (pp) pp.innerHTML = buildPaginationHTML(prodPage, pages, 'goProdPage');
  updateMasterSelectionUI('products');
}
function goProdPage(p){ prodPage=p; renderProducts(); }

function clearProductImage() {
  const area = document.getElementById('pm-img-area');
  if (area._imagePath && window.FB) window.FB.deleteFile(area._imagePath);
  document.getElementById('pm-img-thumb').src = '';
  document.getElementById('pm-img-preview').style.display = 'none';
  document.getElementById('pm-img-placeholder').style.display = 'block';
  document.getElementById('pm-img-actions').style.display = 'none';
  area._imageData = null;
  area._imagePath = null;
  area._imageUploadPromise = null; // discard any stale/stuck upload from a previous attempt
  area._imageUploadFailed = false;
}

function handleProductImageUpload(e) {
  const file = e.target.files[0]; if (!file) return;
  if (file.size > 8*1024*1024) { showToast('Image must be under 8MB','error'); return; }
  const area = document.getElementById('pm-img-area');
  const localPreview = URL.createObjectURL(file); // instant preview, no base64 needed
  const oldPath = area._imagePath; // the file this one is replacing, if any

  document.getElementById('pm-img-thumb').src = localPreview;
  document.getElementById('pm-img-preview').style.display = 'block';
  document.getElementById('pm-img-placeholder').style.display = 'none';
  document.getElementById('pm-img-actions').style.display = 'flex';
  area._imageData = localPreview;
  area._imageUploadFailed = false;

  if (window.FB) {
    const path = 'products/' + (editingProdId || ('new-'+Date.now().toString(36))) + '/' + Date.now() + '_' + file.name;
    area._imageUploadPromise = window.FB.uploadFile(path, file).then(url => {
      if (url) {
        URL.revokeObjectURL(localPreview);
        area._imageData = url; area._imagePath = path; area._imageUploadFailed = false;
        document.getElementById('pm-img-thumb').src = url;
        if (oldPath) window.FB.deleteFile(oldPath); // best-effort, don't wait on it
      } else {
        area._imageUploadFailed = true;
        showToast('Image upload failed — please try again before saving','error');
      }
      return url;
    });
  }
  e.target.value = '';
}

function setProductImageInForm(imageData, imagePath) {
  const area = document.getElementById('pm-img-area');
  area._imageUploadPromise = null; // discard any stale/stuck upload from a previous product session
  area._imageUploadFailed = false;
  area._imagePath = imagePath || null;
  if (imageData) {
    document.getElementById('pm-img-thumb').src = imageData;
    document.getElementById('pm-img-preview').style.display = 'block';
    document.getElementById('pm-img-placeholder').style.display = 'none';
    document.getElementById('pm-img-actions').style.display = 'flex';
    area._imageData = imageData;
  } else {
    clearProductImage();
  }
}

function onCategoryChange() {
  const sel = document.getElementById('pm-cat');
  const addDiv = document.getElementById('pm-cat-add');
  if (sel.value === '__addcat__') {
    addDiv.style.display = 'flex';
    setTimeout(() => document.getElementById('pm-cat-new').focus(), 50);
  } else {
    addDiv.style.display = 'none';
  }
}

function saveNewCategory() {
  const val = document.getElementById('pm-cat-new').value.trim();
  if (!val) return;
  const sel = document.getElementById('pm-cat');
  // Check if already exists
  const exists = Array.from(sel.options).some(o => o.text.toLowerCase() === val.toLowerCase() && o.value !== '__addcat__');
  if (!exists) {
    const opt = document.createElement('option');
    opt.value = val; opt.textContent = val;
    // Insert before "＋ Add new" option
    const addOpt = sel.querySelector('option[value="__addcat__"]');
    sel.insertBefore(opt, addOpt);
    // Save to settings
    if (!settings.customCategories) settings.customCategories = [];
    if (!settings.customCategories.includes(val)) {
      settings.customCategories.push(val);
      saveSettings();
    }
    // Also update filter dropdown
    populateCategoryFilter();
  }
  sel.value = val;
  document.getElementById('pm-cat-new').value = '';
  document.getElementById('pm-cat-add').style.display = 'none';
  showToast('Category "'+val+'" added','success');
}

function cancelNewCategory() {
  document.getElementById('pm-cat-add').style.display = 'none';
  document.getElementById('pm-cat-new').value = '';
  document.getElementById('pm-cat').value = '';
}

function populateCategoryFilter() {
  const builtIn = ['Electrical','Mechanical','Safety','Cleaning','Stationery','Tools',
    'Plumbing','Hardware','Consumables','Food & Beverages','IT Hardware & Software','Other'];
  const custom  = settings.customCategories || [];
  const all     = [...new Set([...builtIn, ...custom])];
  // Get all used categories from products too
  const used = [...new Set(products.map(p=>p.category).filter(Boolean))];
  const combined = [...new Set([...all, ...used])].sort();
  const sel = document.getElementById('prod-cat-filter');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">All categories</option>' +
    combined.map(c=>`<option${c===prev?' selected':''}>${c}</option>`).join('');
}

function loadCustomCategoriesIntoForm() {
  const sel = document.getElementById('pm-cat');
  if (!sel) return;
  const custom = settings.customCategories || [];
  const addOpt = sel.querySelector('option[value="__addcat__"]');
  custom.forEach(cat => {
    if (!Array.from(sel.options).some(o=>o.value===cat)) {
      const opt = document.createElement('option');
      opt.value = cat; opt.textContent = cat;
      sel.insertBefore(opt, addOpt);
    }
  });
}

function openAddProduct() {
  editingProdId = null;
  const delBtn=document.getElementById('prod-edit-delete-btn'); if(delBtn){delBtn.style.display='none';delBtn.removeAttribute('data-pid');}
  document.getElementById('prod-modal-title').textContent = 'Add product';
  ['pm-name','pm-code','pm-brand','pm-model','pm-notes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('pm-cat').value = '';
  document.getElementById('pm-cat-add').style.display = 'none';
  document.getElementById('pm-uom').value = 'Pcs';
  document.getElementById('pm-price').value = '';
  document.getElementById('specs-list').innerHTML = '';
  clearProductImage();
  loadCustomCategoriesIntoForm();
  addSpecRow(); addSpecRow();
  openModalWithSize('prod-modal');
}

function viewProduct(id) {
  const p = products.find(x=>x.id===id); if (!p) return;
  const matchesProduct = it => !!it && ((p.id && (it.productId===p.id || it.productID===p.id)) || (p.code && it.code===p.code));
  const quoteUsage = quotations.filter(q=>(q.items||[]).some(matchesProduct));
  const pricingUsage = rfqs.filter(r=>(r.items||r.lines||[]).some(matchesProduct));
  const soUsage = salesOrders.filter(o=>(o.items||o.lines||[]).some(matchesProduct));
  const totalUsage = quoteUsage.length + pricingUsage.length + soUsage.length;
  const specs = (p.specs||[]).filter(s=>s.k||s.v);
  const image = p.image
    ? `<img class="product-profile-image" src="${p.image}" alt="${p.name||'Product'}">`
    : `<div class="product-profile-image-placeholder"><i class="ti ti-package"></i><span>No product image</span></div>`;
  const specRows = specs.length ? specs.map(s=>`
      <div class="product-profile-spec"><span>${s.k||'—'}</span><strong>${s.v||'—'}</strong></div>`).join('')
    : `<div class="product-profile-empty">No specifications have been added.</div>`;

  document.getElementById('prod-view-body').innerHTML = `
    <div class="product-profile">
      <div class="product-profile-hero">
        <div class="product-profile-identity">
          <div class="product-profile-icon"><i class="ti ti-package"></i></div>
          <div>
            <div class="product-profile-eyebrow">PRODUCT PROFILE</div>
            <h3>${p.name||'Unnamed product'}</h3>
            <div class="product-profile-meta">
              <span class="product-code-chip">${p.code||'No item code'}</span>
              ${p.brand?`<span>${p.brand}</span>`:''}
              ${p.model?`<span>${p.model}</span>`:''}
            </div>
          </div>
        </div>
        <span class="product-profile-status"><i class="ti ti-circle-check-filled"></i> Active</span>
      </div>

      <div class="product-profile-grid">
        <section class="product-profile-card product-profile-info">
          <div class="product-profile-section-title"><i class="ti ti-info-circle"></i><span>Product information</span></div>
          <div class="product-profile-fields">
            <div><label>Item code / SKU</label><strong>${p.code||'—'}</strong></div>
            <div><label>Category</label><span>${p.category||'—'}</span></div>
            <div><label>Brand</label><span>${p.brand||'—'}</span></div>
            <div><label>Model number</label><span>${p.model||'—'}</span></div>
            <div><label>Unit of measure</label><span>${p.uom||'—'}</span></div>
            <div><label>Default price</label><strong class="product-profile-price">${p.price>0?fmt(p.price):'—'}</strong></div>
          </div>
        </section>
        <section class="product-profile-card product-profile-image-card">
          <div class="product-profile-section-title"><i class="ti ti-photo"></i><span>Product image</span></div>
          <div class="product-profile-image-wrap">${image}</div>
        </section>
      </div>

      <div class="product-profile-grid product-profile-lower-grid">
        <section class="product-profile-card">
          <div class="product-profile-section-title"><i class="ti ti-adjustments-horizontal"></i><span>Specifications</span></div>
          <div class="product-profile-specs">${specRows}</div>
        </section>
        <section class="product-profile-card">
          <div class="product-profile-section-title"><i class="ti ti-note"></i><span>Description & notes</span></div>
          <div class="product-profile-notes">${p.notes ? p.notes : '<span>No additional notes for this product.</span>'}</div>
        </section>
      </div>

      <section class="product-profile-card product-profile-usage-card">
        <div class="product-profile-section-title"><i class="ti ti-chart-dots-3"></i><span>Activity & usage</span></div>
        <div class="product-profile-usage">
          <div><span>Quotations</span><strong>${quoteUsage.length}</strong></div>
          <div><span>Pricing / RFQ</span><strong>${pricingUsage.length}</strong></div>
          <div><span>Sales orders</span><strong>${soUsage.length}</strong></div>
          <div class="product-profile-usage-total"><span>Total references</span><strong>${totalUsage}</strong></div>
        </div>
        <div class="product-profile-usage-note"><i class="ti ti-shield-lock"></i>${totalUsage ? 'This product is connected to business records and is protected from deletion.' : 'No business-document references found. Standard delete protection still applies.'}</div>
      </section>
    </div>`;
  document.getElementById('prod-view-title').textContent = 'Product details';
  document.getElementById('prod-view-edit-btn').setAttribute('data-pid', id);
  document.getElementById('prod-view-delete-btn')?.setAttribute('data-pid', id);
  openModalWithSize('prod-view-modal');
}

function openEditProduct(id) {
  const p = products.find(x=>x.id===id); if (!p) return;
  editingProdId = id;
  const delBtn=document.getElementById('prod-edit-delete-btn'); if(delBtn){delBtn.style.display='inline-flex';delBtn.setAttribute('data-pid',id);}
  document.getElementById('prod-modal-title').textContent = 'Edit product';
  document.getElementById('pm-name').value  = p.name||'';
  document.getElementById('pm-code').value  = p.code||'';
  document.getElementById('pm-brand').value = p.brand||'';
  document.getElementById('pm-model').value = p.model||'';
  document.getElementById('pm-cat-add').style.display = 'none';
  document.getElementById('pm-uom').value   = p.uom||'Pcs';
  document.getElementById('pm-price').value = p.price||'';
  document.getElementById('pm-notes').value = p.notes||'';
  document.getElementById('specs-list').innerHTML = '';
  (p.specs||[]).forEach(s => addSpecRow(s.k, s.v));
  if (!(p.specs||[]).length) addSpecRow();
  setProductImageInForm(p.image||null, p.imagePath||null);
  loadCustomCategoriesIntoForm();
  // Set category after loading custom ones
  document.getElementById('pm-cat').value = p.category||'';
  openModalWithSize('prod-modal');
}

function addSpecRow(k='', v='') {
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;gap:8px;align-items:center';
  div.innerHTML = `
    <input placeholder="Spec name (e.g. Color)" value="${k}" style="flex:1;height:30px;border:1px solid var(--border);border-radius:4px;padding:0 8px;font-size:12px;outline:none">
    <input placeholder="Value (e.g. White)" value="${v}" style="flex:1.5;height:30px;border:1px solid var(--border);border-radius:4px;padding:0 8px;font-size:12px;outline:none">
    <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;color:var(--red);font-size:16px;padding:2px 4px"><i class="ti ti-x"></i></button>`;
  document.getElementById('specs-list').appendChild(div);
}

/* saveProduct defined above with quick-add support */

async function deleteProduct(id, sourceModalId='') {
  return requestMasterDelete('products', [id], sourceModalId);
}

/* ── PRODUCT SEARCH IN QUOTE MODAL ── */
let activeQuoteProductRow = null;
let quoteProductHighlight = -1;
let quoteCustomerHighlight = -1;
function resetQuoteProductDropdownPosition(){
  const dd=document.getElementById('prod-search-dd');
  if(!dd)return;
  dd.style.position='absolute';dd.style.top='100%';dd.style.left='0';dd.style.right='0';dd.style.width='auto';
}
function positionQuoteProductDropdown(anchor){
  const dd=document.getElementById('prod-search-dd');
  if(!dd||!anchor)return;
  const r=anchor.getBoundingClientRect();
  dd.style.position='fixed';dd.style.top=(r.bottom+2)+'px';dd.style.left=r.left+'px';dd.style.right='auto';dd.style.width=Math.max(360,r.width)+'px';dd.style.zIndex='1400';
}
function openProdSearch() { activeQuoteProductRow=null; resetQuoteProductDropdownPosition(); filterProdSearch(); }
function closeProdSearch() { const dd=document.getElementById('prod-search-dd'); if(dd) dd.style.display='none'; quoteProductHighlight=-1; }
function filterProdSearch() {
  const q = document.getElementById('prod-search-inp')?.value.toLowerCase()||'';
  const dd = document.getElementById('prod-search-dd'); if (!dd) return;
  const matches = products.filter(p => !q || `${p.name} ${p.brand} ${p.model} ${p.code}`.toLowerCase().includes(q)).slice(0,12);
  dd.innerHTML = matches.map(p => {
    const specPill = (p.specs||[]).slice(0,3).map(s=>`<span style="background:#EBF3FB;color:#1F4E79;border-radius:3px;padding:1px 5px;font-size:10px;margin-right:3px">${s.k}: ${s.v}</span>`).join('');
    const ddImg = p.image
      ? `<img src="${p.image}" style="width:36px;height:36px;object-fit:contain;border-radius:4px;border:1px solid var(--border);flex-shrink:0">`
      : `<div style="width:36px;height:36px;background:var(--blue-pale);border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="ti ti-package" style="font-size:16px;color:var(--blue-light)"></i></div>`;
    return `<div class="quote-search-option" data-product-id="${p.id}" onmousedown="addProductRow('${p.id}',activeQuoteProductRow)" style="padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center">
      ${ddImg}
      <div style="flex:1;min-width:0">
        <div style="font-weight:500;font-size:13px;color:var(--blue)">${p.name}</div>
        <div style="font-size:11px;color:var(--gray);margin-top:2px">${[p.brand,p.model,p.code].filter(Boolean).join(' · ')}</div>
        <div style="margin-top:4px">${specPill}</div>
      </div>
    </div>`;
  }).join('') || `<div style="padding:10px 12px;font-size:12px;color:var(--gray)">No products found. <a href="#" onmousedown="showPage('products',null);closeModal('quote-modal');return false" style="color:var(--blue)">Add to database</a></div>`;
  dd.style.display = 'block';
  quoteProductHighlight = matches.length ? 0 : -1;
  updateQuoteProductHighlight();
}

function isBlankProductRow(tr) {
  if (!tr || tr.dataset.rowKind !== 'product') return false;
  const inputs = [...tr.querySelectorAll('input')];
  const code = inputs[0]?.value.trim() || '';
  const brand = inputs[1]?.value.trim() || '';
  const model = inputs[2]?.value.trim() || '';
  const desc = inputs[3]?.value.trim() || '';
  const specs = inputs[4]?.value.trim() || '';
  const qty = inputs[5]?.value.trim() || '';
  const price = inputs[6]?.value.trim() || '';
  return !code && !brand && !model && !desc && !specs && !qty && !price;
}

function populateProductRow(tr, p) {
  const specLine = (p.specs||[]).map(s=>`${s.k}: ${s.v}`).join(' | ');
  const inputs = [...tr.querySelectorAll('input')];
  if (inputs[0]) inputs[0].value = p.code || '';
  if (inputs[1]) inputs[1].value = p.brand || '';
  if (inputs[2]) inputs[2].value = p.model || '';
  if (inputs[3]) inputs[3].value = p.name || '';
  if (inputs[4]) inputs[4].value = specLine;
  if (inputs[5]) inputs[5].value = 1;
  if (inputs[6]) inputs[6].value = p.price || '';
  const uom = tr.querySelector('select');
  if (uom && p.uom) { uom.value = p.uom; uom.dataset.masterUom=p.uom; uom.disabled=true; }
  tr.dataset.prodId = p.id;
  if (p.image) tr.dataset.image = p.image;
  calcTotals();
  markDirty('quote-modal');
  setTimeout(()=>inputs[5]?.focus(),0);
}

function addProductRow(pid, targetRow=null) {
  const p = products.find(x=>x.id===pid); if (!p) return;
  document.getElementById('prod-search-inp').value = '';
  closeProdSearch();
  const preferredRow = targetRow && targetRow.isConnected && targetRow.dataset.rowKind==='product' ? targetRow : null;
  const blankRow = preferredRow || [...document.querySelectorAll('#items-tbody tr')].find(isBlankProductRow);
  if (blankRow) {
    populateProductRow(blankRow, p);
    activeQuoteProductRow=null;
    return;
  }
  addItemRow({code:p.code, desc:p.name, brand:p.brand||'', model:p.model||'', specs:(p.specs||[]).map(s=>`${s.k}: ${s.v}`).join(' | '), qty:1, uom:p.uom, up:p.price, prodId:p.id});
}


function clearQuoteProductRowMasterData(tr){
  if(!tr || tr.dataset.rowKind!=='product') return;
  const inputs=[...tr.querySelectorAll('input')];
  [0,1,2,4,5,6].forEach(i=>{if(inputs[i]) inputs[i].value='';});
  delete tr.dataset.prodId; delete tr.dataset.image;
  const uom=tr.querySelector('select');
  if(uom){uom.value='Pcs';uom.dataset.masterUom='Pcs';uom.disabled=true;}
  calcTotals(); markDirty('quote-modal');
}
function handleQuoteLineDescriptionFocus(input){
  const tr=input.closest('tr'); if(!tr||tr.dataset.rowKind!=='product')return;
  activeQuoteProductRow=tr;
  const search=document.getElementById('prod-search-inp'); if(search) search.value=input.value.trim();
  filterProdSearch(); positionQuoteProductDropdown(input);
}
function handleQuoteLineDescriptionInput(input){
  const tr=input.closest('tr'); if(!tr||tr.dataset.rowKind!=='product')return;
  activeQuoteProductRow=tr;
  if(!input.value.trim()) clearQuoteProductRowMasterData(tr);
  const search=document.getElementById('prod-search-inp'); if(search) search.value=input.value.trim();
  filterProdSearch(); positionQuoteProductDropdown(input);
}
function updateQuoteProductHighlight(){
  const dd=document.getElementById('prod-search-dd'); if(!dd)return;
  const options=[...dd.querySelectorAll('.quote-search-option')];
  if(!options.length){quoteProductHighlight=-1;return;}
  quoteProductHighlight=Math.max(0,Math.min(quoteProductHighlight,options.length-1));
  options.forEach((el,i)=>el.classList.toggle('keyboard-active',i===quoteProductHighlight));
  options[quoteProductHighlight]?.scrollIntoView({block:'nearest'});
}
function navigateQuoteProductDropdown(event){
  const dd=document.getElementById('prod-search-dd');
  const options=dd?[...dd.querySelectorAll('.quote-search-option')]:[];
  if(!options.length)return false;
  if(event.key==='ArrowDown'){event.preventDefault();quoteProductHighlight=(quoteProductHighlight+1)%options.length;updateQuoteProductHighlight();return true;}
  if(event.key==='ArrowUp'){event.preventDefault();quoteProductHighlight=(quoteProductHighlight-1+options.length)%options.length;updateQuoteProductHighlight();return true;}
  if(event.key==='Enter'){
    event.preventDefault();
    const id=options[Math.max(0,quoteProductHighlight)]?.dataset.productId;
    if(id)addProductRow(id,activeQuoteProductRow);
    return true;
  }
  return false;
}
function handleQuoteLineDescriptionKeydown(event,input){
  if(event.key==='Escape'){closeProdSearch();return;}
  navigateQuoteProductDropdown(event);
}
function handleQuoteProductSearchKey(event) {
  activeQuoteProductRow=null;
  if(event.key==='Escape'){closeProdSearch();return;}
  navigateQuoteProductDropdown(event);
}

/* ── QUOTATION TYPE ── */
function setQuoteType(type, options={}) {
  type = (type === 'contracting') ? 'contracting' : 'product';
  currentQuoteType = type;
  const tabs=document.querySelector('.quote-tabs');
  if(tabs){tabs.classList.toggle('template-locked',!!options.locked);tabs.setAttribute('aria-label',quotationTypeLabel(type)+' template');}
  const heading=document.querySelector('.quote-section-heading > span');
  if(heading) heading.innerHTML='<i class="ti '+quotationTypeIcon(type)+'"></i>'+(type==='contracting'?'Service scope & pricing':'Quotation items');
  ['product','contracting'].forEach(t=>{
    const btn = document.getElementById('type-btn-'+t);
    if (btn) {btn.className = type===t ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';btn.disabled=!!options.locked && type!==t;btn.style.display=options.locked && type!==t?'none':'';btn.style.pointerEvents=options.locked?'none':'';}
  });
  const pbar = document.getElementById('product-search-bar');
  const sbar = document.getElementById('service-add-btn');
  const thead = document.getElementById('items-thead');

  if (type === 'product') {
    pbar.style.display = 'flex';
    sbar.style.display = 'none';
    thead.innerHTML = `<tr>
      <th style="width:32px">#</th><th style="width:110px">Item code</th>
      <th style="width:145px">Brand / Model</th><th>Description &amp; specs</th>
      <th style="width:70px">Qty *</th><th style="width:82px">UOM</th>
      <th style="width:95px">Unit price *</th><th style="width:95px">Total</th><th style="width:95px"></th>
    </tr>`;
  } else {
    pbar.style.display = 'none';
    sbar.style.display = 'flex';
    thead.innerHTML = `<tr>
      <th style="width:32px">#</th><th>Scope of work / Contracting description</th>
      <th style="width:55px">Qty *</th><th style="width:80px">Unit</th>
      <th style="width:95px">Rate *</th><th style="width:95px">Total</th><th style="width:95px"></th>
    </tr>`;
  }
}


function renderAll() { renderDashboard(); renderTable(); renderCustomers(); renderAnalytics(); renderSetupCustTable(); renderProducts(); renderEmployees(); populateCategoryFilter(); populateRFQAssignees(); }

/* ══════════════════════════════════════════════════
   READ-ONLY PRICING VIEWER
══════════════════════════════════════════════════ */


let pricingEntryCloseConfirmOpen=false;
function requestClosePricingEntry(source='close'){
  const modal=document.getElementById('pricing-modal');
  if(!modal || !modal.classList.contains('open') || pricingEntryCloseConfirmOpen) return;
  pricingEntryCloseConfirmOpen=true;

  const isCancel=source==='cancel';
  showConfirm({
    icon:'⚠️',
    title:isCancel?'Cancel Pricing?':'Close Pricing?',
    message:isCancel
      ? 'Are you sure you want to cancel and leave this Pricing screen?'
      : 'Are you sure you want to close this Pricing screen?',
    details:{'Unsaved changes':'Any changes not saved will be discarded.'},
    confirmText:isCancel?'Yes, cancel':'Close',
    cancelText:'Continue editing',
    confirmClass:'btn-primary',
    onConfirm:()=>{
      pricingEntryCloseConfirmOpen=false;
      if(typeof window.bizcorePerformClose==='function'){
        window.bizcorePerformClose('pricing-modal',true);
      }else{
        closeModal('pricing-modal');
      }
    },
    onCancel:()=>{
      pricingEntryCloseConfirmOpen=false;
      setTimeout(()=>document.querySelector('#pricing-modal .pricing-close-btn, #pricing-modal .pricing-cancel-btn')?.focus(),30);
    }
  });
}

window.requestClosePricingEntry=requestClosePricingEntry;

let pricingDetailCloseConfirmOpen=false;
function requestClosePricingDetail(){
  const modal=document.getElementById('pricing-ro-modal');
  if(!modal || !modal.classList.contains('open') || pricingDetailCloseConfirmOpen) return;
  pricingDetailCloseConfirmOpen=true;
  showConfirm({
    icon:'⚠️',
    title:'Close Pricing?',
    message:'Are you sure you want to close this Pricing detail screen?',
    confirmText:'Close',
    cancelText:'Continue viewing',
    confirmClass:'btn-primary',
    onConfirm:()=>{
      pricingDetailCloseConfirmOpen=false;
      closeModal('pricing-ro-modal');
    },
    onCancel:()=>{
      pricingDetailCloseConfirmOpen=false;
      setTimeout(()=>document.querySelector('#pricing-ro-modal .close-btn')?.focus(),30);
    }
  });
}
function openPricingViewRFQ(rfqId){ if(rfqId){ closeModal('pricing-ro-modal'); viewRFQ(rfqId); } }
function openPricingViewQuotation(quotationId){ if(quotationId){ closeModal('pricing-ro-modal'); viewQuotation(quotationId); } }
function pricingViewAttachmentHtml(file, index){
  if(!file || !(file.url || file.data)) return '';
  const src=file.url || file.data;
  const name=escapeHtml(file.name||('Attachment '+(index+1)));
  const supplier=escapeHtml(file.supplier||'');
  const ref=escapeHtml(file.ref||'');
  return '<a class="pricing-view-attachment" href="'+src+'" download="'+name+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">'
    +'<span class="pricing-view-file-icon"><i class="ti ti-paperclip"></i></span>'
    +'<span class="pricing-view-file-text"><strong>'+name+'</strong>'
    +(supplier||ref?'<small>'+[supplier,ref].filter(Boolean).join(' · ')+'</small>':'')
    +'</span><i class="ti ti-download"></i></a>';
}

function viewPricingReadOnly(rfqId) {
  const r = rfqs.find(x=>x.id===rfqId); if (!r) return;
  ensurePricingVersions(r);
  const activeVersion=getCurrentPricingVersion(r);
  if(activeVersion) syncRFQFromPricingVersion(r,activeVersion);
  const items=(r.pricingItems||[]).slice().sort((a,b)=>(Number(a.sortOrder)||0)-(Number(b.sortOrder)||0));
  const versionNo=Number(r.currentPricingVersion)||1;
  const pricingNo='PRC-'+(r.rfqNo||'RFQ')+'-V'+versionNo;
  const linkedQuotationId=activeVersion?.quotationId || r.quotationId || null;
  const linkedQuotation=linkedQuotationId ? quotations.find(q=>q.id===linkedQuotationId) : null;
  const status=activeVersion?.status || (linkedQuotationId?'Converted':'Saved');
  const statusLabel=linkedQuotationId?'Converted to quotation':status;
  const statusClass=/converted|superseded/i.test(status)?'converted':/revision/i.test(status)?'revision':'saved';
  document.getElementById('pricing-ro-title').textContent = pricingNo+' — '+(r.company||'Pricing');

  let materialCost=0,totalSell=0;
  items.forEach(it=>{ materialCost+=(Number(it.buy)||0)*(Number(it.qty)||0); totalSell+=(Number(it.sell)||0)*(Number(it.qty)||0); });
  const additionalCosts=Array.isArray(r.internalCosts)?r.internalCosts.filter(c=>c&&typeof c==='object'):[];
  const additionalTotal=additionalCosts.reduce((sum,c)=>sum+(Number(c.amount)||0),0);
  const totalCost=materialCost+additionalTotal;
  const profit=totalSell-totalCost;
  const marginPct=totalSell ? profit/totalSell*100 : 0;
  const markupPct=totalCost ? profit/totalCost*100 : 0;
  const vatAmt=Math.round(totalSell*vatRate()*100)/100;

  const itemRows=items.length?items.map((it,i)=>{
    const qty=Number(it.qty)||0,buy=Number(it.buy)||0,sell=Number(it.sell)||0;
    const lineCost=buy*qty,lineSell=sell*qty,lineProfit=lineSell-lineCost;
    const lineMargin=lineSell?lineProfit/lineSell*100:0;
    return '<tr>'
      +'<td class="pv-line-no">'+String(i+1).padStart(3,'0')+'</td>'
      +'<td><div class="pv-item-main"><strong>'+escapeHtml(it.desc||'—')+'</strong>'
      +'<span>'+escapeHtml(it.code||'No item code')+'</span></div></td>'
      +'<td><div class="pv-supplier-main"><strong>'+escapeHtml(it.supplierName||r.supplierName||'—')+'</strong>'
      +'<span>'+escapeHtml(it.supRef||r.supRef||'No quotation reference')+'</span></div></td>'
      +'<td class="num">'+formatQuantity(qty)+'</td><td>'+escapeHtml(it.uom||'—')+'</td>'
      +'<td class="num">'+documentMoney('pricing','unitPrice',buy)+'</td><td class="num">'+documentMoney('pricing','unitPrice',sell)+'</td>'
      +'<td class="num">'+documentMoney('pricing','lineAmount',lineProfit)+'</td><td class="num">'+lineMargin.toFixed(1)+'%</td>'
      +'</tr>';
  }).join(''):'<tr><td colspan="9" class="pv-empty">No pricing line items available</td></tr>';

  const methodLabel={fixed:'Fixed amount',material_pct:'% of material cost',total_cost_pct:'% of total cost',sales_pct:'% of total selling'};
  const costRows=additionalCosts.length?additionalCosts.map(c=>{
    const value=Number(c.value)||0, amount=Number(c.amount)||0;
    const calcText=c.method==='fixed'?pricingFmt(value):(value.toFixed(2).replace(/\.00$/,'')+'% · '+(methodLabel[c.method]||'Calculated cost'));
    return '<div class="pv-cost-row"><div class="pv-cost-info"><strong>'+escapeHtml(c.name||'Additional cost')+'</strong><span>'+escapeHtml(calcText)+'</span></div><strong>'+pricingFmt(amount)+'</strong></div>';
  }).join(''):'<div class="pv-empty-card">No additional costs</div>';
  const attachments=(Array.isArray(r.vendorQuotes)&&r.vendorQuotes.length?r.vendorQuotes:(r.pricingAttachment?[r.pricingAttachment]:[]));
  const attachmentHtml=attachments.length?attachments.map(pricingViewAttachmentHtml).join(''):'<div class="pv-empty-card">No attachments added</div>';
  const quoteDate=linkedQuotation?.date||activeVersion?.convertedDate||'';
  const updatedDate=activeVersion?.updated||r.updated||r.created||'';
  const internalNotes=activeVersion?.internalNotes ?? r.internalNotes ?? '';

  document.getElementById('pricing-ro-body').innerHTML =
    '<div class="pricing-view-document">'
    +'<div class="pricing-view-topbar">'
      +'<div class="pricing-view-identity"><div class="pricing-view-kicker">Pricing document</div><h3>'+escapeHtml(pricingNo)+'</h3><div>'+escapeHtml(r.company||'—')+'</div></div>'
      +'<span class="pricing-view-status '+statusClass+'">'+escapeHtml(statusLabel)+'</span>'
    +'</div>'
    +'<div class="pricing-view-meta-grid">'
      +'<div class="pv-meta"><span>Primary supplier</span><strong>'+escapeHtml(r.supplierName||'—')+'</strong></div>'
      +'<div class="pv-meta"><span>Quotation reference</span><strong>'+escapeHtml(r.supRef||'—')+'</strong></div>'
      +'<div class="pv-meta"><span>Quotation date</span><strong>'+(r.supDate?fmtDate(r.supDate):'—')+'</strong></div>'
      +'<div class="pv-meta"><span>Pricing version</span><strong>V'+versionNo+'</strong></div>'
      +'<div class="pv-meta"><span>Last updated</span><strong>'+(updatedDate?fmtDate(updatedDate):'—')+'</strong></div>'
      +'<div class="pv-meta pv-reference"><span>Document references</span><div>'
        +'<button type="button" onclick="openPricingViewRFQ(\''+rfqId+'\')"><i class="ti ti-clipboard-list"></i>'+escapeHtml(r.rfqNo||'RFQ')+'</button>'
        +(linkedQuotation?'<button type="button" onclick="openPricingViewQuotation(\''+linkedQuotation.id+'\')"><i class="ti ti-file-invoice"></i>'+escapeHtml(linkedQuotation.qno||'Quotation')+'</button>':'')
      +'</div></div>'
    +'</div>'
    +'<div class="pricing-view-workspace">'
      +'<main class="pricing-view-main">'
        +'<section class="pricing-view-section"><div class="pv-section-head"><div><span>Line items</span><strong>'+items.length+' item'+(items.length===1?'':'s')+'</strong></div></div>'
          +'<div class="pricing-view-table-wrap"><table class="pricing-view-table"><thead><tr><th>#</th><th>Item / Description</th><th>Supplier / Quote Ref.</th><th class="num">Qty</th><th>UOM</th><th class="num">Buy Price</th><th class="num">Sell Price</th><th class="num">Profit</th><th class="num">Margin</th></tr></thead><tbody>'+itemRows+'</tbody></table></div>'
        +'</section>'
        +'<div class="pricing-view-notes-costs-row">'
          +'<section class="pricing-view-section pricing-view-notes"><div class="pv-section-head"><div><span>Internal notes</span><strong>Internal use only</strong></div></div><div class="pv-note-content">'+(internalNotes?escapeHtml(internalNotes).replace(/\n/g,'<br>'):'<span class="pv-note-empty">No internal notes added</span>')+'</div></section>'
          +'<details class="pricing-view-section pricing-view-additional-costs" open><summary class="pv-section-head pv-collapsible-head"><div><span>Additional costs</span><strong>'+additionalCosts.length+' · '+pricingFmt(additionalTotal)+'</strong></div><i class="ti ti-chevron-down"></i></summary><div class="pv-collapsible-body">'+costRows+'</div></details>'
        +'</div>'
        +'<section class="pricing-view-section"><div class="pv-section-head"><div><span>Attachments</span><strong>'+attachments.length+' file'+(attachments.length===1?'':'s')+'</strong></div></div><div class="pricing-view-attachments">'+attachmentHtml+'</div></section>'
      +'</main>'
      +'<aside class="pricing-view-side">'
        +'<div class="pricing-summary-panel pricing-view-summary"><div class="pricing-summary-title"><i class="ti ti-chart-bar"></i><span class="pricing-summary-title-text">Pricing summary</span></div>'
          +'<div class="pricing-summary">'
            +'<div class="pricing-summary-section">Cost</div>'
            +'<div class="ps-item"><div class="ps-label">Material Cost</div><div class="ps-val">'+documentMoney('pricing','summary',materialCost)+'</div></div>'
            +'<div class="ps-item"><div class="ps-label">Additional Cost</div><div class="ps-val">'+documentMoney('pricing','summary',additionalTotal)+'</div></div>'
            +'<div class="ps-item"><div class="ps-label">Total Cost</div><div class="ps-val">'+documentMoney('pricing','summary',totalCost)+'</div></div>'
            +'<div class="pricing-summary-section">Selling</div>'
            +'<div class="ps-item"><div class="ps-label">Selling Value</div><div class="ps-val">'+documentMoney('pricing','summary',totalSell)+'</div></div>'
            +'<div class="ps-item"><div class="ps-label">VAT ('+(settings.vatrate||15)+'%)</div><div class="ps-val">'+documentMoney('pricing','summary',vatAmt)+'</div></div>'
            +'<div class="ps-item"><div class="ps-label">Net Amount</div><div class="ps-val">'+documentMoney('pricing','grandTotal',totalSell+vatAmt)+'</div></div>'
            +'<div class="pricing-summary-section">Profitability</div>'
            +'<div class="ps-item ps-highlight"><div class="ps-label">Profit</div><div class="ps-val '+(profit>=0?'green':'')+'">'+documentMoney('pricing','summary',profit)+'</div></div>'
            +'<div class="ps-item ps-highlight"><div class="ps-label">Margin %</div><div class="ps-val '+(marginPct>=0?'green':'')+'">'+marginPct.toFixed(1)+'%</div></div>'
            +'<div class="ps-item"><div class="ps-label">Markup %</div><div class="ps-val">'+markupPct.toFixed(1)+'%</div></div>'
          +'</div></div>'
        +(linkedQuotation?'<div class="pricing-view-conversion"><i class="ti ti-circle-check"></i><div><strong>Converted to quotation</strong><button onclick="openPricingViewQuotation(\''+linkedQuotation.id+'\')">'+escapeHtml(linkedQuotation.qno||'Open quotation')+'</button>'+(quoteDate?'<small>'+fmtDate(quoteDate)+'</small>':'')+'</div></div>':'')
      +'</aside>'
    +'</div></div>';

  const roFBtns=[];
  if(navFromQuoteId) roFBtns.push('<button class="btn btn-secondary" onclick="backToQuoteFromRO()"><i class="ti ti-arrow-left"></i>Back to quotation</button>');
  else roFBtns.push('<button class="btn btn-secondary" onclick="closeModal(\'pricing-ro-modal\')">Close</button>');
  roFBtns.push('<button class="btn btn-secondary" data-rid="'+rfqId+'" onclick="backToRFQFromRO(this)"><i class="ti ti-clipboard-list"></i>View RFQ</button>');
  if(linkedQuotation) roFBtns.push('<button class="btn btn-secondary" onclick="openPricingViewQuotation(\''+linkedQuotation.id+'\')"><i class="ti ti-file-invoice"></i>View quotation</button>');
  if(isPricingVersionLocked(r)) roFBtns.push('<button class="btn btn-primary" data-rid="'+rfqId+'" onclick="revisePricingFromRO(this)"><i class="ti ti-git-branch"></i>Revise pricing</button>');
  else roFBtns.push('<button class="btn btn-primary" data-rid="'+rfqId+'" onclick="editPricingFromRO(this)"><i class="ti ti-edit"></i>Edit pricing</button>');
  roFBtns.push('<button class="btn btn-secondary pricing-ro-close-action" type="button" onclick="requestClosePricingDetail()"><i class="ti ti-x"></i>Close</button>');
  document.getElementById('pricing-ro-footer').innerHTML=roFBtns.join('');
  openModalWithSize('pricing-ro-modal');
}


// Pricing detail: Esc follows the same guarded Close behavior.
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape') return;
  const modal=document.getElementById('pricing-ro-modal');
  if(!modal || !modal.classList.contains('open')) return;
  // If BizCore confirmation is already open, let its own Escape handler cancel it.
  if(document.getElementById('app-confirm-overlay')) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  requestClosePricingDetail();
},true);

/* ══════════════════════════════════════════════════
   CUSTOM CONFIRM DIALOG
══════════════════════════════════════════════════ */
function showConfirm({icon='📋', title='Confirm', message='', details=null, confirmText='Confirm', cancelText='Cancel', confirmClass='btn-primary', onConfirm, onCancel}) {
  // Remove any existing confirm
  const existing = document.getElementById('app-confirm-overlay');
  if (existing) existing.remove();

  const detailsHtml = details ? `<div class="confirm-details">${
    Object.entries(details).map(([k,v]) => `<div class="cd-row"><span>${k}</span><span>${v}</span></div>`).join('')
  }</div>` : '';

  const overlay = document.createElement('div');
  overlay.id = 'app-confirm-overlay';
  overlay.className = 'confirm-overlay';

  // Always stack the confirmation above every currently open application modal.
  // This also covers fullscreen Pricing, whose overlay uses a higher z-index.
  const openLayerZIndexes = [...document.querySelectorAll('.modal-overlay.open, .no-bid-overlay, .validation-dialog-overlay, .safe-exit-dialog')]
    .map(el => Number.parseInt(window.getComputedStyle(el).zIndex, 10))
    .filter(Number.isFinite);
  overlay.style.zIndex = String(Math.max(100000, ...openLayerZIndexes) + 100);

  overlay.innerHTML = `
    <div class="confirm-box">
      <div class="confirm-icon">${icon}</div>
      <div class="confirm-title">${title}</div>
      <div class="confirm-msg">${message}</div>
      ${detailsHtml}
      <div class="confirm-btns">
        <button class="btn btn-secondary" id="confirm-cancel">${cancelText}</button>
        <button class="btn ${confirmClass}" id="confirm-ok">${confirmText}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('confirm-ok').onclick = () => { overlay.remove(); if (onConfirm) onConfirm(); };
  document.getElementById('confirm-cancel').onclick = () => { overlay.remove(); if (onCancel) onCancel(); };
  // ESC key closes
  const escHandler = e => { if(e.key==='Escape') { overlay.remove(); if(onCancel) onCancel(); document.removeEventListener('keydown',escHandler); } };
  document.addEventListener('keydown', escHandler);
  // Focus confirm button
  setTimeout(() => document.getElementById('confirm-ok')?.focus(), 50);
}

/* ══════════════════════════════════════════════════
   BASIC USERS + ROLES (PROTOTYPE STORAGE)
══════════════════════════════════════════════════ */
const ROLE_MODULES=['Dashboard','Customers','Suppliers','Products','Quotations','Sales Orders','Delivery Notes','Reports','Setup'];
const ROLE_ACTIONS=['view','create','edit','delete','print','approve'];
function defaultPermissions(all=false){const out={};ROLE_MODULES.forEach(m=>{out[m]={};ROLE_ACTIONS.forEach(a=>out[m][a]=all);});return out;}
function loadAccessSetup(){
  try{appRoles=JSON.parse(localStorage.getItem('bizcore_roles')||'[]');}catch{appRoles=[];}
  try{appUsers=JSON.parse(localStorage.getItem('bizcore_users')||'[]');}catch{appUsers=[];}
  if(!appRoles.length){
    appRoles=[
      {id:'role-admin',name:'Administrator',permissions:defaultPermissions(true),system:true},
      {id:'role-manager',name:'Manager',permissions:defaultPermissions(false),system:true},
      {id:'role-sales',name:'Sales',permissions:defaultPermissions(false),system:true},
      {id:'role-accounts',name:'Accounts',permissions:defaultPermissions(false),system:true},
      {id:'role-store',name:'Storekeeper',permissions:defaultPermissions(false),system:true}
    ];
    ['role-manager','role-sales'].forEach(id=>{const r=appRoles.find(x=>x.id===id);['Dashboard','Customers','Products','Quotations','Sales Orders'].forEach(m=>['view','create','edit','print'].forEach(a=>r.permissions[m][a]=true));});
    const ac=appRoles.find(x=>x.id==='role-accounts');['Dashboard','Customers','Quotations','Sales Orders','Reports'].forEach(m=>['view','print'].forEach(a=>ac.permissions[m][a]=true));
    const st=appRoles.find(x=>x.id==='role-store');['Dashboard','Products','Sales Orders'].forEach(m=>['view','edit','print'].forEach(a=>st.permissions[m][a]=true));
    saveAccessSetup();
  }
  if(!appUsers.length){appUsers=[{id:'user-admin',fullname:'Administrator',username:'admin',password:'',email:'',roleId:'role-admin',active:true}];saveAccessSetup();}
  if(!selectedRoleId)selectedRoleId=appRoles[0]?.id||null;
}
function saveAccessSetup(){localStorage.setItem('bizcore_roles',JSON.stringify(appRoles));localStorage.setItem('bizcore_users',JSON.stringify(appUsers));}
function populateUserRoles(){const sel=document.getElementById('u-role');if(sel)sel.innerHTML=appRoles.map(r=>`<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');}
function openUserForm(id=null){loadAccessSetup();editingUserId=id;populateUserRoles();const card=document.getElementById('user-form-card');if(!card)return;card.style.display='block';const u=id?appUsers.find(x=>x.id===id):null;document.getElementById('user-form-title').textContent=u?'Edit user':'New user';document.getElementById('u-fullname').value=u?.fullname||'';document.getElementById('u-username').value=u?.username||'';document.getElementById('u-password').value=u?.password||'';document.getElementById('u-email').value=u?.email||'';document.getElementById('u-role').value=u?.roleId||appRoles[0]?.id||'';document.getElementById('u-active').value=String(u?.active!==false);setTimeout(()=>document.getElementById('u-fullname')?.focus(),50);}
function closeUserForm(){editingUserId=null;const c=document.getElementById('user-form-card');if(c)c.style.display='none';}
function saveUser(){const fullname=document.getElementById('u-fullname').value.trim(),username=document.getElementById('u-username').value.trim();if(!fullname||!username){showToast('Full name and username are required','error');return;}if(appUsers.some(u=>u.username.toLowerCase()===username.toLowerCase()&&u.id!==editingUserId)){showToast('Username already exists','error');return;}const obj={id:editingUserId||('user-'+Date.now()),fullname,username,password:document.getElementById('u-password').value,email:document.getElementById('u-email').value.trim(),roleId:document.getElementById('u-role').value,active:document.getElementById('u-active').value==='true'};if(editingUserId){const i=appUsers.findIndex(x=>x.id===editingUserId);appUsers[i]=obj;}else appUsers.push(obj);saveAccessSetup();closeUserForm();renderUsers();showToast('User saved','success');}
function deleteUser(id){if(id==='user-admin'){showToast('The default administrator cannot be deleted','error');return;}showConfirm({icon:'👤',title:'Delete user?',message:'This removes the prototype login account.',confirmText:'Delete user',confirmClass:'btn-danger',onConfirm:()=>{appUsers=appUsers.filter(x=>x.id!==id);saveAccessSetup();renderUsers();showToast('User deleted');}});}
function renderUsers(){loadAccessSetup();populateUserRoles();const body=document.getElementById('users-tbody');if(!body)return;const q=(document.getElementById('user-search')?.value||'').toLowerCase();const rows=appUsers.filter(u=>{const role=appRoles.find(r=>r.id===u.roleId)?.name||'';return [u.fullname,u.username,u.email,role].join(' ').toLowerCase().includes(q);});body.innerHTML=rows.length?rows.map(u=>{const role=appRoles.find(r=>r.id===u.roleId)?.name||'—';const initials=(u.fullname||'?').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();return `<tr><td><div style="display:flex;align-items:center;gap:9px"><div class="user-avatar">${escapeHtml(initials)}</div><div><strong>${escapeHtml(u.fullname)}</strong><div style="font-size:10px;color:var(--gray)">${escapeHtml(u.email||'No email')}</div></div></div></td><td>${escapeHtml(u.username)}</td><td>${escapeHtml(role)}</td><td><span class="status-pill ${u.active?'active':'inactive'}"><i class="ti ti-circle-filled" style="font-size:6px"></i>${u.active?'Active':'Inactive'}</span></td><td><div class="action-btns"><button class="abtn abtn-edit" onclick="openUserForm('${u.id}')"><i class="ti ti-edit"></i></button><button class="abtn abtn-del" onclick="deleteUser('${u.id}')"><i class="ti ti-trash"></i></button></div></td></tr>`;}).join(''):`<tr><td colspan="5" style="text-align:center;color:var(--gray);padding:24px">No users found.</td></tr>`;}
function renderRoles(){loadAccessSetup();const list=document.getElementById('role-list');if(!list)return;if(!appRoles.some(r=>r.id===selectedRoleId))selectedRoleId=appRoles[0]?.id;list.innerHTML=appRoles.map(r=>`<div class="role-item ${r.id===selectedRoleId?'active':''}" onclick="selectRole('${r.id}')"><span>${escapeHtml(r.name)}</span><span style="font-size:10px;color:var(--gray)">${appUsers.filter(u=>u.roleId===r.id).length} users</span></div>`).join('');renderPermissionMatrix();}
function selectRole(id){selectedRoleId=id;renderRoles();}
function renderPermissionMatrix(){const role=appRoles.find(r=>r.id===selectedRoleId);const name=document.getElementById('role-editor-name'),body=document.getElementById('permission-tbody');if(!role||!body)return;if(name)name.textContent=role.name;body.innerHTML=ROLE_MODULES.map(m=>`<tr><td><strong>${m}</strong></td>${ROLE_ACTIONS.map(a=>`<td><input type="checkbox" data-module="${m}" data-action="${a}" ${role.permissions?.[m]?.[a]?'checked':''}></td>`).join('')}</tr>`).join('');}
function saveRolePermissions(){const role=appRoles.find(r=>r.id===selectedRoleId);if(!role)return;role.permissions=role.permissions||defaultPermissions(false);document.querySelectorAll('#permission-tbody input[type=checkbox]').forEach(cb=>{role.permissions[cb.dataset.module]=role.permissions[cb.dataset.module]||{};role.permissions[cb.dataset.module][cb.dataset.action]=cb.checked;});saveAccessSetup();showToast('Role permissions saved','success');}
function addRole(){const name=prompt('Role name');if(!name||!name.trim())return;if(appRoles.some(r=>r.name.toLowerCase()===name.trim().toLowerCase())){showToast('Role already exists','error');return;}const r={id:'role-'+Date.now(),name:name.trim(),permissions:defaultPermissions(false),system:false};appRoles.push(r);selectedRoleId=r.id;saveAccessSetup();renderRoles();populateUserRoles();showToast('Role added','success');}



/* Units of Measure Master */
function persistUomMaster(){ localStorage.setItem('bizcore_uom_master',JSON.stringify(uomMaster)); UOM_LIST=uomMaster.filter(u=>u.active).map(u=>u.code); }
function renderUomMaster(){
  const body=document.getElementById('uom-tbody'); if(!body)return;
  const q=(document.getElementById('uom-search')?.value||'').trim().toLowerCase();
  const rows=uomMaster.filter(u=>`${u.code} ${u.name}`.toLowerCase().includes(q)).sort((a,b)=>a.code.localeCompare(b.code));
  const count=document.getElementById('uom-count'); if(count)count.textContent=`${rows.length} unit${rows.length===1?'':'s'}`;
  body.innerHTML=rows.length?rows.map(u=>`<tr><td><strong>${escapeHtml(u.code)}</strong></td><td>${escapeHtml(u.name)}</td><td class="center"><span class="uom-decimal-badge">${u.decimals}</span></td><td class="right">${Number(u.step).toLocaleString('en-US',{maximumFractionDigits:3})}</td><td class="center"><span class="status-pill ${u.active?'active':'inactive'}">${u.active?'Active':'Inactive'}</span></td><td class="center"><div class="action-btns"><button class="abtn abtn-edit" onclick="openUomForm('${u.id}')" title="Edit"><i class="ti ti-edit"></i></button><button class="abtn abtn-del" onclick="deleteUomMaster('${u.id}')" title="Delete"><i class="ti ti-trash"></i></button></div></td></tr>`).join(''):'<tr><td colspan="6" style="text-align:center;color:var(--gray);padding:28px">No units found.</td></tr>';
}
function openUomForm(id=null){
  editingUomId=id; const u=id?uomMaster.find(x=>x.id===id):null;
  document.getElementById('uom-form-panel').style.display='block'; document.getElementById('uom-form-title').textContent=u?'Edit unit of measure':'New unit of measure';
  document.getElementById('uom-code').value=u?.code||''; document.getElementById('uom-name').value=u?.name||''; document.getElementById('uom-decimals').value=String(u?.decimals??0); document.getElementById('uom-step').value=String(u?.step??1); document.getElementById('uom-active').value=String(u?.active!==false);
  setTimeout(()=>document.getElementById('uom-code')?.focus(),30);
}
function closeUomForm(){ editingUomId=null; const p=document.getElementById('uom-form-panel');if(p)p.style.display='none'; }
function syncUomStepSuggestion(){ const d=Number(document.getElementById('uom-decimals').value)||0; document.getElementById('uom-step').value=String(d===0?1:1/Math.pow(10,d)); }
function saveUomMaster(){
  const code=document.getElementById('uom-code').value.trim(),name=document.getElementById('uom-name').value.trim(),decimals=Math.max(0,Math.min(3,Number(document.getElementById('uom-decimals').value)||0)),step=parseBizNumber(document.getElementById('uom-step').value),active=document.getElementById('uom-active').value==='true';
  if(!code||!name){showToast('UOM code and unit name are required','error');return;} if(step<=0){showToast('Quantity step must be greater than zero','error');return;}
  if(uomMaster.some(u=>u.code.toLowerCase()===code.toLowerCase()&&u.id!==editingUomId)){showToast('This UOM code already exists','error');return;}
  const obj={id:editingUomId||('uom-'+Date.now()),code,name,decimals,step,active}; if(editingUomId){const i=uomMaster.findIndex(u=>u.id===editingUomId);uomMaster[i]=obj;}else uomMaster.push(obj);
  persistUomMaster(); closeUomForm(); renderUomMaster(); refreshProductUomSelect(); showToast('Unit of measure saved','success');
}
function deleteUomMaster(id){
  const u=uomMaster.find(x=>x.id===id); if(!u)return; const used=products.some(p=>String(p.uom).toLowerCase()===u.code.toLowerCase())||quotations.some(q=>(q.items||[]).some(i=>String(i.uom).toLowerCase()===u.code.toLowerCase()));
  if(used){showToast('This UOM is already used. Mark it inactive instead of deleting it.','error');return;}
  showConfirm({icon:'📏',title:'Delete unit of measure?',message:`Delete ${u.code} — ${u.name}?`,confirmText:'Delete UOM',confirmClass:'btn-danger',onConfirm:()=>{uomMaster=uomMaster.filter(x=>x.id!==id);persistUomMaster();renderUomMaster();refreshProductUomSelect();showToast('Unit deleted','success');}});
}
function refreshProductUomSelect(){ const sel=document.getElementById('pm-uom');if(!sel)return;const current=sel.value;sel.innerHTML=uomMaster.filter(u=>u.active).map(u=>`<option value="${escapeHtml(u.code)}">${escapeHtml(u.code)} — ${escapeHtml(u.name)}</option>`).join('');if([...sel.options].some(o=>o.value===current))sel.value=current; }

function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g,function(ch){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
  });
}
// Backward-compatible short helper used by newer master-data modules.
// Keeping this alias prevents one rendering error from stopping the full app initialization.
function esc(value){ return escapeHtml(value); }

/* Cost Components Master */
const DEFAULT_COST_COMPONENTS = [
  {id:'cc-transport',seq:1,name:'Transport',type:'Fixed',value:0,base:'—',enabled:true,editable:true},
  {id:'cc-freight',seq:2,name:'Freight',type:'%',value:5,base:'Material Cost',enabled:true,editable:true},
  {id:'cc-installation',seq:3,name:'Installation',type:'%',value:10,base:'Material Cost',enabled:true,editable:true},
  {id:'cc-contingency',seq:4,name:'Contingency',type:'%',value:5,base:'Total Cost',enabled:true,editable:true},
  {id:'cc-zakat',seq:5,name:'Zakat Provision',type:'%',value:2.5,base:'Total Selling',enabled:true,editable:false}
];
let costComponents=[];
let costComponentsBaseline='';
let costComponentsDirty=false;
let editingCostComponentId=null;

function normaliseCostComponents(raw){
  let list=Array.isArray(raw)?raw:[];
  list=list.filter(x=>x&&typeof x==='object').map((x,i)=>({
    id:x.id||('cc-'+Date.now()+'-'+i),seq:Number(x.seq)||i+1,name:String(x.name||'').trim(),
    type:x.type==='%'?'%':'Fixed',value:Number(x.value)||0,
    base:x.type==='%'?(x.base||'Material Cost'):'—',enabled:x.enabled!==false,
    editable:typeof x.editable==='boolean'?x.editable:true
  })).filter(x=>x.name);
  DEFAULT_COST_COMPONENTS.forEach(def=>{
    const found=list.find(x=>x.id===def.id||x.name.toLowerCase()===def.name.toLowerCase());
    if(!found)list.push({...def});
    else if(typeof found.editable!=='boolean')found.editable=def.editable;
  });
  return list.sort((a,b)=>a.seq-b.seq||a.name.localeCompare(b.name));
}
function readStoredCostComponents(){
  let raw=[];try{raw=JSON.parse(localStorage.getItem('bizcore_cost_components')||'[]');}catch{raw=[];}
  return normaliseCostComponents(raw);
}
function initialiseCostComponents(force=false){
  if(force||!costComponents.length){
    costComponents=readStoredCostComponents();
    const serial=JSON.stringify(costComponents);
    if(localStorage.getItem('bizcore_cost_components')!==serial)localStorage.setItem('bizcore_cost_components',serial);
    costComponentsBaseline=serial;costComponentsDirty=false;
  }
  updateCostComponentActionState();
}
function saveCostComponents(){localStorage.setItem('bizcore_cost_components',JSON.stringify(costComponents));}
function markCostComponentsDirty(){
  costComponentsDirty=JSON.stringify(costComponents)!==costComponentsBaseline;
  updateCostComponentActionState();
}
function updateCostComponentActionState(){
  const apply=document.getElementById('cost-components-apply-btn');
  const cancel=document.getElementById('cost-components-cancel-btn');
  const status=document.getElementById('cost-components-change-status');
  if(apply)apply.disabled=!costComponentsDirty;if(cancel)cancel.disabled=!costComponentsDirty;
  if(status){status.textContent=costComponentsDirty?'Unsaved changes pending':'No pending changes';status.style.color=costComponentsDirty?'#b45309':'var(--gray)';}
}
function renderCostComponents(){
  initialiseCostComponents();
  const body=document.getElementById('cost-components-tbody'); if(!body)return;
  const rows=[...costComponents].sort((a,b)=>a.seq-b.seq||a.name.localeCompare(b.name));
  const count=document.getElementById('cost-component-count');if(count)count.textContent=`${rows.length} component${rows.length===1?'':'s'}`;
  body.innerHTML=rows.length?rows.map(c=>`<tr>
    <td><strong>${c.seq}</strong></td><td><strong>${escapeHtml(c.name)}</strong></td>
    <td><span class="status-pill ${c.type==='%'?'active':'inactive'}">${c.type==='%'?'Percentage':'Fixed'}</span></td>
    <td class="right"><strong>${c.type==='%'?Number(c.value).toLocaleString(undefined,{maximumFractionDigits:2})+'%':Number(c.value).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></td>
    <td>${escapeHtml(c.base||'—')}</td>
    <td class="center"><span class="status-pill ${c.editable?'active':'inactive'}"><i class="ti ${c.editable?'ti-edit':'ti-lock'}" style="margin-right:4px"></i>${c.editable?'Editable':'Locked'}</span></td>
    <td class="center"><label class="switch" title="Enable or disable"><input type="checkbox" ${c.enabled?'checked':''} onchange="toggleCostComponent('${c.id}',this.checked)"><span class="slider"></span></label></td>
    <td><div class="action-btns" style="justify-content:center"><button class="abtn abtn-edit" onclick="openCostComponentForm('${c.id}')" title="Edit"><i class="ti ti-edit"></i></button><button class="abtn abtn-del" onclick="deleteCostComponent('${c.id}')" title="Delete"><i class="ti ti-trash"></i></button></div></td>
  </tr>`).join(''):`<tr><td colspan="8" style="text-align:center;color:var(--gray);padding:28px">No cost components created.</td></tr>`;
  updateCostComponentActionState();
}
function openCostComponentForm(id=null){
  initialiseCostComponents();editingCostComponentId=id;const c=id?costComponents.find(x=>x.id===id):null;
  document.getElementById('cost-component-form').style.display='block';
  document.getElementById('cost-component-form-title').innerHTML=`<i class="ti ti-calculator" style="margin-right:6px"></i>${c?'Edit cost component':'New cost component'}`;
  document.getElementById('cc-seq').value=c?.seq||(Math.max(0,...costComponents.map(x=>Number(x.seq)||0))+1);
  document.getElementById('cc-name').value=c?.name||'';document.getElementById('cc-type').value=c?.type||'Fixed';
  document.getElementById('cc-value').value=c?.value??0;document.getElementById('cc-base').value=c?.base||'—';
  document.getElementById('cc-enabled').value=String(c?.enabled!==false);document.getElementById('cc-editable').value=String(c?.editable!==false);
  updateCostComponentBaseOptions();setTimeout(()=>document.getElementById('cc-name')?.focus(),50);
}
function closeCostComponentForm(){editingCostComponentId=null;const f=document.getElementById('cost-component-form');if(f)f.style.display='none';}
function updateCostComponentBaseOptions(){const type=document.getElementById('cc-type')?.value,base=document.getElementById('cc-base');if(!base)return;if(type==='Fixed'){base.value='—';base.disabled=true;}else{base.disabled=false;if(base.value==='—')base.value='Material Cost';}}
function saveCostComponent(){
  const seq=parseInt(document.getElementById('cc-seq').value,10),name=document.getElementById('cc-name').value.trim(),type=document.getElementById('cc-type').value,value=parseFloat(document.getElementById('cc-value').value),base=type==='Fixed'?'—':document.getElementById('cc-base').value,enabled=document.getElementById('cc-enabled').value==='true',editable=document.getElementById('cc-editable').value==='true';
  if(!seq||seq<1){showToast('Enter a valid sequence','error');return;}if(!name){showToast('Component name is required','error');return;}if(!Number.isFinite(value)||value<0){showToast('Enter a valid value','error');return;}if(type==='%'&&base==='—'){showToast('Select a calculation base','error');return;}
  if(costComponents.some(x=>x.name.toLowerCase()===name.toLowerCase()&&x.id!==editingCostComponentId)){showToast('Component name already exists','error');return;}
  const obj={id:editingCostComponentId||('cc-'+Date.now()),seq,name,type,value,base,enabled,editable};
  if(editingCostComponentId){const i=costComponents.findIndex(x=>x.id===editingCostComponentId);if(i>=0)costComponents[i]=obj;}else costComponents.push(obj);
  costComponents.sort((a,b)=>a.seq-b.seq||a.name.localeCompare(b.name));closeCostComponentForm();markCostComponentsDirty();renderCostComponents();showToast('Change added. Click Apply Changes to confirm.','success');
}
function toggleCostComponent(id,enabled){const c=costComponents.find(x=>x.id===id);if(!c)return;c.enabled=enabled;markCostComponentsDirty();renderCostComponents();}
function deleteCostComponent(id){const c=costComponents.find(x=>x.id===id);if(!c)return;costComponents=costComponents.filter(x=>x.id!==id);closeCostComponentForm();markCostComponentsDirty();renderCostComponents();showToast('Component marked for deletion. Apply changes to confirm.','success');}
function requestApplyCostComponentChanges(){
  if(!costComponentsDirty)return;
  showConfirm({icon:'✅',title:'Apply cost component changes?',message:'Save these changes as the new defaults for future pricing calculations?',confirmText:'Yes, apply changes',confirmClass:'btn-primary',onConfirm:()=>{
    saveCostComponents();costComponentsBaseline=JSON.stringify(costComponents);costComponentsDirty=false;closeCostComponentForm();renderCostComponents();showToast('Cost component changes applied','success');
  }});
}
function requestCancelCostComponentChanges(){
  if(!costComponentsDirty)return;
  showConfirm({icon:'↩️',title:'Cancel pending changes?',message:'Discard all unsaved changes and restore the last applied cost component settings?',confirmText:'Yes, discard changes',confirmClass:'btn-danger',onConfirm:()=>{
    costComponents=JSON.parse(costComponentsBaseline||'[]');costComponentsDirty=false;closeCostComponentForm();renderCostComponents();showToast('Pending changes cancelled','success');
  }});
}
function costComponentToPricingCost(c){
  let method='fixed';
  if(c.type==='%') method=c.base==='Material Cost'?'material_pct':c.base==='Total Cost'?'total_cost_pct':'sales_pct';
  return {masterId:c.id,seq:c.seq,name:c.name,method,value:Number(c.value)||0,base:c.base,locked:c.editable===false,fromMaster:true};
}
function getEnabledMasterPricingCosts(){return readStoredCostComponents().filter(c=>c.enabled).sort((a,b)=>a.seq-b.seq).map(costComponentToPricingCost);}

/* Margin Status Master + Pricing Settings */
const DEFAULT_MARGIN_STATUSES=[
  {id:'ms-loss',seq:1,name:'Loss',icon:'⛔',from:-999,to:0,color:'#dc2626',active:true},
  {id:'ms-very-low',seq:2,name:'Very Low',icon:'⚠️',from:0,to:5,color:'#dc2626',active:true},
  {id:'ms-low',seq:3,name:'Low',icon:'▼',from:5,to:10,color:'#ea580c',active:true},
  {id:'ms-normal',seq:4,name:'Normal',icon:'●',from:10,to:20,color:'#2563eb',active:true},
  {id:'ms-good',seq:5,name:'Good',icon:'✓',from:20,to:35,color:'#16a34a',active:true},
  {id:'ms-excellent',seq:6,name:'Excellent',icon:'★',from:35,to:999,color:'#047857',active:true}
];
let marginStatuses=[],marginStatusesBaseline='[]',marginStatusesDirty=false,editingMarginStatusId=null;
function readStoredMarginStatuses(){try{const x=JSON.parse(localStorage.getItem('bizcoreMarginStatuses')||'null');const rows=Array.isArray(x)&&x.length?x:structuredClone(DEFAULT_MARGIN_STATUSES);return rows.map((v,i)=>({...v,icon:v.icon||DEFAULT_MARGIN_STATUSES.find(d=>d.id===v.id)?.icon||['⛔','⚠️','▼','●','✓','★'][i]||'●'}))}catch(_){return structuredClone(DEFAULT_MARGIN_STATUSES)}}
function initMarginStatuses(){marginStatuses=readStoredMarginStatuses();marginStatusesBaseline=JSON.stringify(marginStatuses);marginStatusesDirty=false;renderMarginStatuses()}
function saveMarginStatusesApplied(){localStorage.setItem('bizcoreMarginStatuses',JSON.stringify(marginStatuses))}
function markMarginStatusesDirty(){marginStatusesDirty=true;updateMarginStatusChangeUI()}
function updateMarginStatusChangeUI(){const a=document.getElementById('margin-status-apply-btn'),c=document.getElementById('margin-status-cancel-btn'),t=document.getElementById('margin-status-change-status');if(a)a.disabled=!marginStatusesDirty;if(c)c.disabled=!marginStatusesDirty;if(t){t.textContent=marginStatusesDirty?'Unsaved changes pending':'No pending changes';t.style.color=marginStatusesDirty?'#b45309':'var(--gray)'}}
function renderMarginStatuses(){const tb=document.getElementById('margin-status-tbody');if(!tb)return;marginStatuses.sort((a,b)=>a.seq-b.seq);tb.innerHTML=marginStatuses.map(x=>`<tr><td><strong>${x.seq}</strong></td><td><strong>${escapeHtml(x.name)}</strong></td><td class="center"><span class="margin-icon-preview" title="${escapeHtml(x.name)} icon">${escapeHtml(x.icon||'●')}</span></td><td class="right">${Number(x.from).toFixed(1)}%</td><td class="right">${Number(x.to).toFixed(1)}%</td><td><span class="margin-color-preview"><span class="margin-color-dot" style="background:${x.color}"></span>${String(x.color).toUpperCase()}</span></td><td class="center"><label class="switch"><input type="checkbox" ${x.active?'checked':''} onchange="toggleMarginStatus('${x.id}',this.checked)"><span class="slider"></span></label></td><td><div class="action-btns" style="justify-content:center"><button class="abtn abtn-edit" onclick="openMarginStatusForm('${x.id}')" title="Edit"><i class="ti ti-edit"></i></button><button class="abtn abtn-del" onclick="deleteMarginStatus('${x.id}')" title="Delete"><i class="ti ti-trash"></i></button></div></td></tr>`).join('');const cnt=document.getElementById('margin-status-count');if(cnt)cnt.textContent=marginStatuses.length+' '+(marginStatuses.length===1?'status':'statuses');updateMarginStatusChangeUI()}
function marginColorName(c){return({'#dc2626':'Red','#ea580c':'Orange','#2563eb':'Blue','#16a34a':'Green','#047857':'Dark Green','#7c3aed':'Purple','#64748b':'Slate'})[c]||c}
function isValidHexColor(value){return /^#[0-9A-Fa-f]{6}$/.test(String(value||'').trim())}
function syncMarginColorHex(value){const h=document.getElementById('ms-color-hex');if(h)h.value=String(value||'#2563eb').toUpperCase()}
function syncMarginColorPicker(value){const v=String(value||'').trim();if(isValidHexColor(v)){const p=document.getElementById('ms-color');if(p)p.value=v;}}
function normaliseMarginColorHex(){const h=document.getElementById('ms-color-hex'),p=document.getElementById('ms-color');if(!h||!p)return;if(isValidHexColor(h.value)){p.value=h.value;h.value=h.value.toUpperCase()}else{h.value=p.value.toUpperCase();showToast('Enter a valid HEX colour such as #F59E0B','error')}}
function updateMarginIconPreview(){const input=document.getElementById('ms-icon'),preview=document.getElementById('ms-icon-preview');if(preview)preview.textContent=(input?.value||'●').trim()||'●'}
function openMarginStatusForm(id=null){editingMarginStatusId=id;const f=document.getElementById('margin-status-form');if(!f)return;const x=id?marginStatuses.find(v=>v.id===id):null;document.getElementById('margin-status-form-title').innerHTML='<i class="ti ti-chart-line" style="margin-right:6px"></i>'+(x?'Edit margin status':'New margin status');document.getElementById('ms-seq').value=x?.seq??(marginStatuses.length?Math.max(...marginStatuses.map(v=>v.seq))+1:1);document.getElementById('ms-name').value=x?.name||'';document.getElementById('ms-icon').value=x?.icon||'●';updateMarginIconPreview();document.getElementById('ms-from').value=x?.from??0;document.getElementById('ms-to').value=x?.to??10;document.getElementById('ms-color').value=x?.color||'#2563eb';document.getElementById('ms-color-hex').value=(x?.color||'#2563eb').toUpperCase();document.getElementById('ms-active').value=String(x?.active??true);f.style.display='block';document.getElementById('ms-name').focus()}
function closeMarginStatusForm(){editingMarginStatusId=null;const f=document.getElementById('margin-status-form');if(f)f.style.display='none'}
function saveMarginStatusDraft(){const seq=parseInt(document.getElementById('ms-seq').value,10),name=document.getElementById('ms-name').value.trim(),icon=(document.getElementById('ms-icon').value||'').trim(),from=parseFloat(document.getElementById('ms-from').value),to=parseFloat(document.getElementById('ms-to').value),color=document.getElementById('ms-color-hex').value.trim().toLowerCase(),active=document.getElementById('ms-active').value==='true';if(!seq||!name||!icon||!Number.isFinite(from)||!Number.isFinite(to)){showToast('Complete all required fields','error');return}if(!isValidHexColor(color)){showToast('Choose a valid colour or enter a HEX code such as #F59E0B','error');return}if(to<=from){showToast('To % must be greater than From %','error');return}if(marginStatuses.some(x=>x.name.toLowerCase()===name.toLowerCase()&&x.id!==editingMarginStatusId)){showToast('Status name already exists','error');return}const obj={id:editingMarginStatusId||('ms-'+Date.now()),seq,name,icon,from,to,color,active};if(editingMarginStatusId){const i=marginStatuses.findIndex(x=>x.id===editingMarginStatusId);if(i>=0)marginStatuses[i]=obj}else marginStatuses.push(obj);closeMarginStatusForm();markMarginStatusesDirty();renderMarginStatuses();showToast('Change added. Click Apply Changes to confirm.','success')}
function toggleMarginStatus(id,active){const x=marginStatuses.find(v=>v.id===id);if(!x)return;x.active=active;markMarginStatusesDirty();renderMarginStatuses()}
function deleteMarginStatus(id){marginStatuses=marginStatuses.filter(x=>x.id!==id);closeMarginStatusForm();markMarginStatusesDirty();renderMarginStatuses()}
function validateMarginStatusRanges(){const a=marginStatuses.filter(x=>x.active).sort((x,y)=>x.from-y.from);for(let i=1;i<a.length;i++){if(a[i].from<a[i-1].to)return `Ranges overlap: ${a[i-1].name} and ${a[i].name}`}return ''}
function requestApplyMarginStatusChanges(){if(!marginStatusesDirty)return;const err=validateMarginStatusRanges();if(err){showToast(err,'error');return}showConfirm({icon:'✅',title:'Apply margin status changes?',message:'Save these ranges and use them in pricing calculations?',confirmText:'Yes, apply changes',confirmClass:'btn-primary',onConfirm:()=>{saveMarginStatusesApplied();marginStatusesBaseline=JSON.stringify(marginStatuses);marginStatusesDirty=false;closeMarginStatusForm();renderMarginStatuses();updateMarginGaugeScale();calcPricingSummary();showToast('Margin status changes applied','success')}})}
function requestCancelMarginStatusChanges(){if(!marginStatusesDirty)return;showConfirm({icon:'↩️',title:'Cancel pending changes?',message:'Discard all unsaved Margin Status changes?',confirmText:'Yes, discard changes',confirmClass:'btn-danger',onConfirm:()=>{marginStatuses=JSON.parse(marginStatusesBaseline||'[]');marginStatusesDirty=false;closeMarginStatusForm();renderMarginStatuses();showToast('Pending changes cancelled','success')}})}
function getMarginStatusForPercent(pct){const a=readStoredMarginStatuses().filter(x=>x.active).sort((x,y)=>x.seq-y.seq);return a.find((x,i)=>pct>=Number(x.from)&&(pct<Number(x.to)||i===a.length-1&&pct<=Number(x.to)))||null}

function updateMarginGaugeScale(){
  const gauge=document.getElementById('margin-gauge');
  if(!gauge)return;
  const statuses=readStoredMarginStatuses().filter(x=>x.active).sort((a,b)=>Number(a.from)-Number(b.from));
  const stops=[];
  statuses.forEach(status=>{
    const from=Math.max(0,Math.min(100,Number(status.from)));
    const to=Math.max(0,Math.min(100,Number(status.to)));
    if(to<=from)return;
    stops.push(`${status.color} ${from.toFixed(2)}%`,`${status.color} ${to.toFixed(2)}%`);
  });
  gauge.style.background=stops.length?`linear-gradient(0deg,${stops.join(',')})`:'linear-gradient(0deg,#e2e8f0 0%,#e2e8f0 100%)';
}

const DEFAULT_PRICING_SETTINGS={currency:'SAR',decimals:2,vat:15,marginMethod:'markup',allowBelowCost:false,warnLow:true,minMargin:10,managerApproval:true,includeCosts:true,roundSelling:false,roundMethod:'0.01',validity:7,targetMargin:20};
let pricingSettings={...DEFAULT_PRICING_SETTINGS},pricingSettingsBaseline='',pricingSettingsDirty=false;
function readPricingSettings(){try{return {...DEFAULT_PRICING_SETTINGS,...JSON.parse(localStorage.getItem('bizcorePricingSettings')||'{}')}}catch(_){return {...DEFAULT_PRICING_SETTINGS}}}
function initPricingSettings(){pricingSettings=readPricingSettings();pricingSettingsBaseline=JSON.stringify(pricingSettings);pricingSettingsDirty=false;renderPricingSettings()}
function renderPricingSettings(){const map={'pset-currency':'currency','pset-decimals':'decimals','pset-margin-method':'marginMethod','pset-min-margin':'minMargin','pset-round-method':'roundMethod','pset-validity':'validity','pset-target-margin':'targetMargin'};for(const [id,k] of Object.entries(map)){const e=document.getElementById(id);if(e)e.value=pricingSettings[k]}const checks={'pset-allow-below-cost':'allowBelowCost','pset-warn-low':'warnLow','pset-manager-approval':'managerApproval','pset-include-costs':'includeCosts','pset-round-selling':'roundSelling'};for(const [id,k] of Object.entries(checks)){const e=document.getElementById(id);if(e)e.checked=!!pricingSettings[k]}updatePricingSettingsChangeUI()}
function collectPricingSettings(){return{currency:document.getElementById('pset-currency')?.value||'SAR',decimals:Number(document.getElementById('pset-decimals')?.value||2),marginMethod:document.getElementById('pset-margin-method')?.value||'markup',allowBelowCost:!!document.getElementById('pset-allow-below-cost')?.checked,warnLow:!!document.getElementById('pset-warn-low')?.checked,minMargin:Number(document.getElementById('pset-min-margin')?.value||10),managerApproval:!!document.getElementById('pset-manager-approval')?.checked,includeCosts:!!document.getElementById('pset-include-costs')?.checked,roundSelling:!!document.getElementById('pset-round-selling')?.checked,roundMethod:document.getElementById('pset-round-method')?.value||'0.01',validity:Number(document.getElementById('pset-validity')?.value||7),targetMargin:Number(document.getElementById('pset-target-margin')?.value||20)}}
function markPricingSettingsDirty(){pricingSettings=collectPricingSettings();pricingSettingsDirty=JSON.stringify(pricingSettings)!==pricingSettingsBaseline;updatePricingSettingsChangeUI()}
function updatePricingSettingsChangeUI(){const a=document.getElementById('pricing-settings-apply-btn'),c=document.getElementById('pricing-settings-cancel-btn'),t=document.getElementById('pricing-settings-change-status');if(a)a.disabled=!pricingSettingsDirty;if(c)c.disabled=!pricingSettingsDirty;if(t){t.textContent=pricingSettingsDirty?'Unsaved changes pending':'No pending changes';t.style.color=pricingSettingsDirty?'#b45309':'var(--gray)'}}
function requestApplyPricingSettingsChanges(){if(!pricingSettingsDirty)return;showConfirm({icon:'✅',title:'Apply pricing settings?',message:'Save these settings as the defaults for new pricing calculations?',confirmText:'Yes, apply settings',confirmClass:'btn-primary',onConfirm:()=>{pricingSettings=collectPricingSettings();localStorage.setItem('bizcorePricingSettings',JSON.stringify(pricingSettings));pricingSettingsBaseline=JSON.stringify(pricingSettings);pricingSettingsDirty=false;renderPricingSettings();applyPricingSettingsToOpenScreens();showToast('Pricing settings applied and activated','success')}})}
function requestCancelPricingSettingsChanges(){if(!pricingSettingsDirty)return;showConfirm({icon:'↩️',title:'Cancel pending changes?',message:'Discard all unsaved Pricing Settings changes?',confirmText:'Yes, discard changes',confirmClass:'btn-danger',onConfirm:()=>{pricingSettings=JSON.parse(pricingSettingsBaseline);pricingSettingsDirty=false;renderPricingSettings();showToast('Pending changes cancelled','success')}})}


/* Pricing Settings live integration */
function activePricingSettings(){ pricingSettings={...DEFAULT_PRICING_SETTINGS,...readPricingSettings()}; return pricingSettings; }
function pricingDecimals(){ return Math.max(0,Math.min(4,Number(activePricingSettings().decimals)||2)); }
function pricingCurrency(){ return activePricingSettings().currency||'SAR'; }
function pricingFmt(n){ return pricingCurrency()+' '+formatNumber(n,pricingDecimals()); }
function pricingRound(value){
  const ps=activePricingSettings(); let v=Number(value)||0;
  if(ps.roundSelling){ const step=Math.max(0.000001,Number(ps.roundMethod)||0.01); v=Math.round((v+Number.EPSILON)/step)*step; }
  return Number(v.toFixed(pricingDecimals()));
}
function pricingPercent(cost,sell){
  cost=Number(cost)||0; sell=Number(sell)||0;
  return activePricingSettings().marginMethod==='gross_margin' ? (sell?((sell-cost)/sell*100):0) : (cost?((sell-cost)/cost*100):0);
}
function sellingFromPricingPercent(cost,pct){
  cost=Number(cost)||0; pct=Number(pct)||0;
  if(activePricingSettings().marginMethod==='gross_margin'){
    if(pct>=100) pct=99.99;
    return pricingRound(cost/(1-pct/100));
  }
  return pricingRound(cost*(1+pct/100));
}
function pricingMethodLabel(){ return activePricingSettings().marginMethod==='gross_margin'?'Margin %':'Markup %'; }
function getLivePricingMetrics(){
  let materialCost=0,totalSell=0;
  document.querySelectorAll('#pricing-tbody tr:not(.pricing-quick-add-row)').forEach(tr=>{
    const q=parsePricingNumber(tr.querySelector('[data-role="qty"]')?.value);
    const b=parsePricingNumber(tr.querySelector('[data-role="buy"]')?.value);
    const sell=parsePricingNumber(tr.querySelector('[data-role="sell"]')?.value);
    materialCost+=q*b; totalSell+=q*sell;
  });
  const internal=readInternalCosts(materialCost,totalSell), totalCost=materialCost+internal.total;
  return {materialCost,totalSell,internalTotal:internal.total,totalCost,profit:totalSell-totalCost,pct:pricingPercent(totalCost,totalSell)};
}
function updatePricingSettingsRuntimeUI(){
  const ps=activePricingSettings();
  document.querySelectorAll('#pricing-table th').forEach(th=>{if(/markup|margin %/i.test(th.textContent.trim()) && !/overall/i.test(th.textContent)) th.textContent=pricingMethodLabel();});
  document.querySelectorAll('#pricing-tbody [data-role="buy"],#pricing-tbody [data-role="sell"]').forEach(el=>{el.placeholder=(0).toFixed(pricingDecimals());});
  const target=document.getElementById('margin-gauge-target'); if(target) target.textContent='Target '+Number(ps.targetMargin||0).toFixed(1)+'%';
  const vatEls=document.querySelectorAll('[data-pricing-vat-label]'); vatEls.forEach(e=>e.textContent='VAT ('+Number(ps.vat||0).toFixed(2).replace(/\.00$/,'')+'%)');
  if(document.getElementById('pricing-tbody')) calcPricingSummary();
}
function checkPricingBusinessRules(showMessages=true){
  const ps=activePricingSettings(),m=getLivePricingMetrics();
  if(m.totalSell>0 && m.profit<0 && !ps.allowBelowCost){ if(showMessages)showToast('Selling below total cost is blocked by Pricing Settings.','error'); return {ok:false,needsApproval:false,metrics:m}; }
  const low=m.totalSell>0 && m.pct<Number(ps.minMargin||0);
  if(low && ps.warnLow && showMessages) showToast('Margin '+m.pct.toFixed(1)+'% is below the minimum '+Number(ps.minMargin||0).toFixed(1)+'%.','warning');
  return {ok:true,needsApproval:low&&ps.managerApproval,metrics:m};
}
let pricingManagerApprovedForCurrentSave=false;
function obtainPricingManagerApproval(){
  const entered=window.prompt('Manager approval required. Enter the System Administration PIN:');
  if(entered===null)return false;
  const stored=localStorage.getItem('dtq_admin_pin')||'1234';
  if(entered!==stored){showToast('Manager approval PIN is incorrect.','error');return false;}
  pricingManagerApprovedForCurrentSave=true;showToast('Manager approval recorded for this pricing save.','success');return true;
}
function applyPricingSettingsToOpenScreens(){
  activePricingSettings(); updatePricingSettingsRuntimeUI();
  const validity=document.getElementById('f-validity');
  if(validity && !editingId) { validity.value=Math.max(1,Number(pricingSettings.validity)||7); if(typeof updateValidUntil==='function')updateValidUntil(); }
}

/* ══════════════════════════════════════════════════
   SETUP TABS + ADMIN PIN
══════════════════════════════════════════════════ */
let adminUnlocked = false;
const DEFAULT_PIN = '1234';

function switchSetupTab(tab) {
  const setupPage=document.getElementById('page-setup');
  setupPage?.querySelectorAll('.setup-tab').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected','false'); b.tabIndex=-1; });
  setupPage?.querySelectorAll('.setup-tab-content').forEach(c => c.style.display = 'none');
  const tabButton=document.getElementById('stab-' + tab);
  const tabContent=document.getElementById('setup-tab-' + tab);
  if(!tabButton||!tabContent)return;
  tabButton.classList.add('active');
  tabButton.setAttribute('aria-selected','true');
  tabButton.tabIndex=0;
  tabContent.style.display = 'block';
  const tabTitle=tabButton.querySelector('.tab-title')?.textContent;
  if(tabTitle)document.getElementById('page-title').textContent=tabTitle;
  if (tab === 'admin') {
    if (adminUnlocked) {
      document.getElementById('admin-pin-gate').style.display = 'none';
      document.getElementById('admin-content').style.display = 'block';
      applySettings();
    } else {
      document.getElementById('admin-pin-gate').style.display = 'flex';
      document.getElementById('admin-content').style.display = 'none';
      setTimeout(() => document.getElementById('admin-pin-input').focus(), 100);
    }
  }
  if (tab === 'users') renderUsers();
  if (tab === 'roles') renderRoles();
  if (tab === 'defaults') { renderSetupTermsList('delivery'); renderSetupTermsList('payment'); }
  if (tab === 'cost-components') renderCostComponents();
  if (tab === 'margin-status') renderMarginStatuses();
  if (tab === 'pricing-settings') renderPricingSettings();
  if (tab === 'currency-display') renderCurrencyDisplaySettings();
  if (tab === 'branding') { applySettings(); updateBrandPreview(); }
}


function verifyAdminPin() {
  const pin = document.getElementById('admin-pin-input').value;
  const stored = localStorage.getItem('dtq_admin_pin') || DEFAULT_PIN;
  if (pin === stored) {
    adminUnlocked = true;
    document.getElementById('admin-pin-error').style.display = 'none';
    document.getElementById('admin-pin-input').value = '';
    document.getElementById('admin-pin-gate').style.display = 'none';
    document.getElementById('admin-content').style.display = 'block';
    applySettings();
  } else {
    document.getElementById('admin-pin-error').style.display = 'block';
    document.getElementById('admin-pin-input').value = '';
    document.getElementById('admin-pin-input').focus();
  }
}

function lockAdmin() {
  adminUnlocked = false;
  document.getElementById('admin-pin-gate').style.display = 'flex';
  document.getElementById('admin-content').style.display = 'none';
  switchSetupTab('branding');
}

function changeAdminPin() {
  const cur = document.getElementById('pin-current').value;
  const nw  = document.getElementById('pin-new').value;
  const cf  = document.getElementById('pin-confirm').value;
  const stored = localStorage.getItem('dtq_admin_pin') || DEFAULT_PIN;
  if (cur !== stored) { showToast('Current PIN is incorrect','error'); return; }
  if (nw.length < 4)  { showToast('New PIN must be at least 4 digits','error'); return; }
  if (nw !== cf)      { showToast('New PINs do not match','error'); return; }
  localStorage.setItem('dtq_admin_pin', nw);
  ['pin-current','pin-new','pin-confirm'].forEach(id => document.getElementById(id).value = '');
  showToast('Admin PIN updated successfully','success');
}

function setPartyField(id, value='') { const el=document.getElementById(id); if(el) el.value=value ?? ''; }
function getPartyField(id) { return document.getElementById(id)?.value?.trim() || ''; }
function resetCustomerPartyFields(company='') {
  const values={
    'cm-company':company,'cm-company-ar':'','cm-vat':'','cm-mobile':'','cm-email':'',
    'cm-short-address':'','cm-building-no':'','cm-street':'','cm-street-ar':'','cm-secondary-no':'',
    'cm-postal-code':'','cm-district':'','cm-district-ar':'','cm-city':'','cm-city-ar':'','cm-country':'Saudi Arabia'
  };
  Object.entries(values).forEach(([id,v])=>setPartyField(id,v));
}
function resetSupplierPartyFields(company='') {
  const ids=['sm-company-ar','sm-contact','sm-contact-ar','sm-mobile','sm-phone','sm-email','sm-whatsapp','sm-cat','sm-vat','sm-short-address','sm-building-no','sm-street','sm-street-ar','sm-secondary-no','sm-postal-code','sm-district','sm-district-ar','sm-city','sm-city-ar','sm-notes'];
  ids.forEach(id=>setPartyField(id,'')); setPartyField('sm-company',company); setPartyField('sm-country','Saudi Arabia');
}
function validOptionalEmail(value){ return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function partyAddressSummary(r){
  const line1=[r.buildingNo,r.street].filter(Boolean).join(' ');
  const line2=[r.district,r.city,r.postalCode].filter(Boolean).join(', ');
  const ar1=[r.buildingNo,r.streetAr].filter(Boolean).join(' ');
  const ar2=[r.districtAr,r.cityAr,r.postalCode].filter(Boolean).join('، ');
  return {line1,line2,ar1,ar2,country:r.country||'Saudi Arabia'};
}

/* ══════════════════════════════════════════════════
   QUICK-ADD CUSTOMER FROM QUOTATION (return to position)
══════════════════════════════════════════════════ */
let quickAddContext = null; // 'customer' | 'product'

function quickAddCustomerFromQuote() {
  quickAddContext = 'customer';
  // Save quotation scroll position
  const body = document.querySelector('#quote-modal .modal-body');
  if (body) body._savedScroll = body.scrollTop;
  // Open customer modal on top — it will stack via z-index
  editingCustId = null;
  document.getElementById('cust-modal-title').textContent = 'Add new customer';
  resetCustomerPartyFields('');
  document.getElementById('cm-contacts-list').innerHTML = '';
  addContactRow();
  // Raise z-index so it appears above the quote modal
  document.getElementById('cust-modal').style.zIndex = '1200';
  openModalWithSize('cust-modal');
}

function quickAddProductFromQuote() {
  quickAddContext = 'product';
  const body = document.querySelector('#quote-modal .modal-body');
  if (body) body._savedScroll = body.scrollTop;
  editingProdId = null;
  document.getElementById('prod-modal-title').textContent = 'Add new product';
  ['pm-name','pm-code','pm-brand','pm-model','pm-notes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('pm-cat').value = '';
  document.getElementById('pm-uom').value = 'Pcs';
  document.getElementById('pm-price').value = '';
  document.getElementById('specs-list').innerHTML = '';
  addSpecRow(); addSpecRow();
  document.getElementById('prod-modal').style.zIndex = '1200';
  openModalWithSize('prod-modal');
}

// Override saveCustomer to handle quick-add return
const _origSaveCustomer = saveCustomer;
async function saveCustomer() {
  const company = document.getElementById('cm-company').value.trim();
  if (!company) { showToast('Company name is required','error'); return; }
  const contacts = [];
  document.querySelectorAll('#cm-contacts-list .contact-row').forEach(row => {
    const inputs = row.querySelectorAll('input');
    const name  = inputs[0]?.value.trim();
    const title = inputs[1]?.value.trim();
    const phone = inputs[2]?.value.trim();
    if (name) contacts.push({name, title, phone, isDefault: row.classList.contains('default-contact')});
  });
  const defaultContact = contacts.find(x=>x.isDefault) || contacts[0];
  const email=getPartyField('cm-email');
  if(!validOptionalEmail(email)){ showToast('Enter a valid customer email address','error'); return; }
  const c = {
    ...(editingCustId ? (customers.find(x=>x.id===editingCustId)||{}) : {}),
    id: editingCustId || (Date.now().toString(36)),
    company,
    companyAr:getPartyField('cm-company-ar'), vat:getPartyField('cm-vat'), mobile:getPartyField('cm-mobile'), email,
    shortAddress:getPartyField('cm-short-address'), buildingNo:getPartyField('cm-building-no'), street:getPartyField('cm-street'), streetAr:getPartyField('cm-street-ar'),
    secondaryNo:getPartyField('cm-secondary-no'), postalCode:getPartyField('cm-postal-code'), district:getPartyField('cm-district'), districtAr:getPartyField('cm-district-ar'),
    city:getPartyField('cm-city'), cityAr:getPartyField('cm-city-ar'), country:getPartyField('cm-country')||'Saudi Arabia',
    contacts,
    contact: defaultContact?.name || '',
    phone: defaultContact?.phone || getPartyField('cm-mobile')
  };
  if (editingCustId) { const idx = customers.findIndex(x=>x.id===editingCustId); if(idx>-1) customers[idx]=c; }
  else customers.push(c);
  await saveCustomers();
  clearDirty(); closeModal('cust-modal');
  document.getElementById('cust-modal').style.zIndex = '';
  renderCustomers(); renderSetupCustTable();
  showToast(editingCustId ? 'Customer updated' : 'Customer added','success');

  // If called from quotation form — auto-select the new customer
  if (quickAddContext === 'customer' && !editingCustId) {
    quickAddContext = null;
    const newCust = customers.find(x=>x.id===c.id);
    if (newCust) {
      selectCustomer(newCust.id);
      const body = document.querySelector('#quote-modal .modal-body');
      if (body && body._savedScroll !== undefined) setTimeout(() => { body.scrollTop = body._savedScroll; }, 50);
    }
  } else if (quickAddContext === 'rfq_customer' && !editingCustId) {
    quickAddContext = null;
    const newCust = customers.find(x=>x.id===c.id);
    if (newCust) {
      selectRFQCustomer(newCust.id);
      const body = document.querySelector('#rfq-modal .modal-body');
      if (body && body._savedScroll !== undefined) setTimeout(() => { body.scrollTop = body._savedScroll; }, 50);
      markDirty('rfq-modal');
    }
  } else {
    quickAddContext = null;
  }
}

// Override saveProduct to handle quick-add return
const _origSaveProduct = saveProduct;
async function saveProduct() {
  const name = document.getElementById('pm-name').value.trim();
  if (!name) { showToast('Product name is required','error'); return; }
  const specs = [];
  document.querySelectorAll('#specs-list > div').forEach(row => {
    const inputs = row.querySelectorAll('input');
    const k = inputs[0]?.value.trim(); const v = inputs[1]?.value.trim();
    if (k && v) specs.push({k,v});
  });
  const catVal = document.getElementById('pm-cat').value;
  const category = (catVal === '__addcat__' || !catVal) ? '' : catVal;
  const imgArea = document.getElementById('pm-img-area');
  if (imgArea._imageUploadPromise) { showToast('Finishing image upload…','success'); await imgArea._imageUploadPromise; }
  if (imgArea._imageUploadFailed) { showValidationDialog('Image upload failed','The product image could not be uploaded. Check your connection and try selecting the image again, or remove it and save without one.',document.getElementById('pm-img-area')); return; }
  showBusyOverlay('prod-modal', 'Saving product…');
  try {
  const imageData = imgArea._imageData || null;
  const p = {
    id: editingProdId || ('p'+Date.now().toString(36)),
    name, code: document.getElementById('pm-code').value.trim(),
    brand: document.getElementById('pm-brand').value.trim(),
    model: document.getElementById('pm-model').value.trim(),
    category,
    uom: document.getElementById('pm-uom').value,
    price: parseFloat(document.getElementById('pm-price').value)||0,
    notes: document.getElementById('pm-notes').value.trim(),
    specs,
    image: imageData,
    imagePath: imgArea._imagePath || null
  };
  const isNew = !editingProdId;
  if (editingProdId) { const i=products.findIndex(x=>x.id===editingProdId); if(i>-1) products[i]=p; }
  else products.unshift(p);
  await saveProducts();
  clearDirty(); closeModal('prod-modal');
  document.getElementById('prod-modal').style.zIndex = '';
  renderProducts();
  showToast(editingProdId ? 'Product updated' : 'Product added','success');

  // If called from quotation form — auto-add the new product as a line item
  if (quickAddContext === 'product' && isNew) {
    quickAddContext = null;
    const specLine = (p.specs||[]).map(s=>s.k+': '+s.v).join(' | ');
    addItemRow({code:p.code, desc:p.name, brand:p.brand||'', model:p.model||'', specs:specLine, qty:1, uom:p.uom, up:p.price, prodId:p.id});
    const body = document.querySelector('#quote-modal .modal-body');
    if (body) setTimeout(() => { body.scrollTop = body.scrollHeight; }, 50);
    showToast(p.name + ' added to quotation','success');
  } else if (quickAddContext === 'product_pricing' && isNew) {
    quickAddContext = null;
    document.getElementById('prod-modal').style.zIndex='';
    // Add to pricing sheet
    addProductToPricing(p.id);
    showToast(p.name + ' added to pricing sheet','success');
  } else {
    quickAddContext = null;
  }
  } finally { hideBusyOverlay('prod-modal'); }
}

/* ── DASHBOARD ── */
let dashFrom = '', dashTo = '';

function getDashQuotations() {
  if (!dashFrom && !dashTo) return quotations;
  return quotations.filter(q => {
    if (dashFrom && q.date < dashFrom) return false;
    if (dashTo   && q.date > dashTo)   return false;
    return true;
  });
}

function setDashPeriod(preset, el) {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-based
  // helper: returns YYYY-MM-DD string without timezone shift
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  document.querySelectorAll('.dash-period-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');

  if (preset === 'all') {
    dashFrom = ''; dashTo = '';
    document.getElementById('dash-date-from').value = '';
    document.getElementById('dash-date-to').value = '';
  } else {
    let from, to;
    if (preset === 'thismonth') {
      from = new Date(y, m, 1);         // 1st of current month
      to   = new Date(y, m+1, 0);       // last day of current month
    } else if (preset === 'lastmonth') {
      from = new Date(y, m-1, 1);       // 1st of previous month
      to   = new Date(y, m, 0);         // last day of previous month
    } else if (preset === 'last3') {
      from = new Date(y, m-2, 1);       // 1st of 3 months ago
      to   = new Date(y, m+1, 0);       // last day of current month
    } else if (preset === 'thisyear') {
      from = new Date(y, 0, 1);         // Jan 1st
      to   = new Date(y, 11, 31);       // Dec 31st
    }
    dashFrom = fmt(from);
    dashTo   = fmt(to);
    document.getElementById('dash-date-from').value = dashFrom;
    document.getElementById('dash-date-to').value   = dashTo;
  }
  renderDashboard();
}

function onDashCustomDate() {
  dashFrom = document.getElementById('dash-date-from').value;
  dashTo   = document.getElementById('dash-date-to').value;
  // deselect preset buttons since user picked custom
  document.querySelectorAll('.dash-period-btn').forEach(b => b.classList.remove('active'));
  renderDashboard();
}


function openDashboardSalesOrder(soId) {
  showPage('salesorders',document.querySelector('[data-nav-page="salesorders"]'));
  requestAnimationFrame(()=>{
    const contentScroller=document.querySelector('.content');
    if(contentScroller) contentScroller.scrollTop=0;
    viewSO(soId);
  });
}

function openDashboardNewRFQ() {
  showPage('rfq',document.querySelector('[data-nav-page="rfq"]'));
  requestAnimationFrame(()=>openNewRFQ());
}

function renderDashboard() {
  const list=salesOrders.filter(so=>{
    const d=so.date||'';
    if(dashFrom && d<dashFrom) return false;
    if(dashTo && d>dashTo) return false;
    return true;
  }).map(so=>({...so,_status:getSOStatus(so)}));
  const total=list.length;
  const paid=list.filter(so=>so._status==='Paid');
  const pendingDelivery=list.filter(so=>['Confirmed','Out for Delivery','Partially Delivered'].includes(so._status));
  const pendingPayment=list.filter(so=>['Invoiced','Partially Paid'].includes(so._status));
  const paidValue=paid.reduce((sum,so)=>sum+(parseFloat(so.total)||0),0);
  const orderValue=list.reduce((sum,so)=>sum+(parseFloat(so.total)||0),0);
  document.getElementById('s-total').textContent=total;
  document.getElementById('s-total-sub').textContent=(!dashFrom&&!dashTo)?'all time':(dashFrom&&dashTo?fmtDate(dashFrom)+' → '+fmtDate(dashTo):fmtDate(dashFrom||dashTo));
  document.getElementById('s-won').textContent=paid.length;
  document.getElementById('s-won-val').textContent=fmtShort(paidValue);
  document.getElementById('s-pending').textContent=pendingDelivery.length;
  document.getElementById('s-lost').textContent=pendingPayment.length;
  document.getElementById('s-pipeline').textContent=fmtShort(orderValue);

  const lbl=document.getElementById('dash-period-label');
  if(lbl) lbl.textContent=(!dashFrom&&!dashTo)?`Showing all ${salesOrders.length} sales orders`:`Showing ${total} of ${salesOrders.length} sales orders · ${fmtDate(dashFrom)} → ${fmtDate(dashTo)}`;

  const recent=[...list].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,8);
  document.getElementById('recent-tbody').innerHTML=recent.length?recent.map(so=>`<tr class="dashboard-order-row" role="link" tabindex="0" aria-label="Open sales order ${so.soNo||''}" onclick="openDashboardSalesOrder('${so.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openDashboardSalesOrder('${so.id}')}"><td><span class="dashboard-order-link">${so.soNo||'—'}</span></td><td>${fmtDate(so.date)}</td><td>${so.customer||'—'}</td><td class="right" style="font-weight:500">${fmtShort(parseFloat(so.total)||0)}</td><td><span class="badge ${getSOBadgeClass(so._status)}">${so._status}</span></td></tr>`).join(''):`<tr><td colspan="5" style="text-align:center;color:var(--gray);padding:24px">No sales orders in this period</td></tr>`;

  const statuses=['Confirmed','Out for Delivery','Partially Delivered','Delivered','Invoiced','Partially Paid','Paid'];
  const colors={'Confirmed':'#185FA5','Out for Delivery':'#6f42c1','Partially Delivered':'#e67e22','Delivered':'#117a8b','Invoiced':'#6c757d','Partially Paid':'#d39e00','Paid':'#1e7e34'};
  document.getElementById('status-chart').innerHTML=statuses.map(st=>{const count=list.filter(so=>so._status===st).length;const pct=total?Math.round(count/total*100):0;return `<div style="display:flex;align-items:center;gap:8px"><div style="width:105px;font-size:11px;color:var(--gray)">${st}</div><div style="flex:1;background:#f0f0f0;border-radius:3px;height:12px"><div style="width:${pct}%;height:100%;background:${colors[st]};border-radius:3px"></div></div><div style="width:40px;font-size:11px;text-align:right;color:${colors[st]};font-weight:600">${count}</div></div>`;}).join('');

  const months=[];for(let i=5;i>=0;i--){const d=new Date();d.setMonth(d.getMonth()-i);months.push({label:d.toLocaleString('default',{month:'short'}),key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`});}
  const values=months.map(m=>list.filter(so=>(so.date||'').startsWith(m.key)).reduce((sum,so)=>sum+(parseFloat(so.total)||0),0));
  const maxVal=Math.max(1,...values);
  document.getElementById('monthly-chart').innerHTML=months.map((m,i)=>{const val=values[i];const h=Math.round(val/maxVal*72);return `<div class="bar-wrap"><div class="bar-val">${val>0?fmtShort(val):''}</div><div class="bar" style="height:${Math.max(h,2)}px"></div><div class="bar-label">${m.label}</div></div>`;}).join('');
}

/* ── QUOTATION REGISTER DATE FILTER ── */
let quotationDatePreset = 'all';

function quotationISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function toggleQuotationDateMenu(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById('quotation-date-menu');
  const btn = document.getElementById('quotation-date-filter-btn');
  if (!menu) return;
  const open = !menu.classList.contains('open');
  menu.classList.toggle('open', open);
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function closeQuotationDateMenu() {
  const menu = document.getElementById('quotation-date-menu');
  const btn = document.getElementById('quotation-date-filter-btn');
  if (menu) menu.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded','false');
}

function updateQuotationDateFilterUI(label, preset) {
  quotationDatePreset = preset || 'custom';
  const labelEl = document.getElementById('quotation-date-filter-label');
  const btn = document.getElementById('quotation-date-filter-btn');
  if (labelEl) labelEl.textContent = label || 'All Dates';
  if (btn) btn.classList.toggle('active', quotationDatePreset !== 'all');
  document.querySelectorAll('#quotation-date-menu .quotation-date-preset').forEach(b => b.classList.toggle('active', b.dataset.preset === quotationDatePreset));
}

function setQuotationDatePreset(preset) {
  const fromEl = document.getElementById('filter-date-from');
  const toEl = document.getElementById('filter-date-to');
  if (!fromEl || !toEl) return;
  const today = new Date(); today.setHours(0,0,0,0);
  const y=today.getFullYear(), m=today.getMonth(), dow=today.getDay();
  let from=null, to=null, label='All Dates';
  if (preset === 'today') { from=today; to=today; label='Today'; }
  else if (preset === 'week') {
    const mondayOffset = dow === 0 ? -6 : 1-dow;
    from = new Date(y,m,today.getDate()+mondayOffset);
    to = new Date(from); to.setDate(from.getDate()+6); label='This Week';
  } else if (preset === 'month') { from=new Date(y,m,1); to=new Date(y,m+1,0); label='This Month'; }
  else if (preset === 'lastmonth') { from=new Date(y,m-1,1); to=new Date(y,m,0); label='Last Month'; }
  else if (preset === '30days') { from=new Date(today); from.setDate(from.getDate()-29); to=today; label='Last 30 Days'; }
  else if (preset === 'last3months') { from=new Date(y,m-3,1); to=new Date(y,m,0); label='Last 3 Months'; }

  fromEl.value = from ? quotationISODate(from) : '';
  toEl.value = to ? quotationISODate(to) : '';
  updateQuotationDateFilterUI(label, preset);
  currentPage=1;
  closeQuotationDateMenu();
  renderTable();
}

function markQuotationDateCustom() {
  updateQuotationDateFilterUI('Custom Range','custom');
}

function applyQuotationCustomDate() {
  const from = document.getElementById('filter-date-from')?.value || '';
  const to = document.getElementById('filter-date-to')?.value || '';
  if (from && to && from > to) { showToast('From date cannot be after To date','warning'); return; }
  const label = from || to ? [from,to].filter(Boolean).map(fmtDate).join(' → ') : 'All Dates';
  updateQuotationDateFilterUI(label, from || to ? 'custom' : 'all');
  currentPage=1;
  closeQuotationDateMenu();
  renderTable();
}

function clearQuotationDateFilter() {
  const fromEl=document.getElementById('filter-date-from');
  const toEl=document.getElementById('filter-date-to');
  if(fromEl) fromEl.value='';
  if(toEl) toEl.value='';
  updateQuotationDateFilterUI('All Dates','all');
  currentPage=1;
  closeQuotationDateMenu();
  renderTable();
}

document.addEventListener('click', function(e){
  const wrap = e.target.closest ? e.target.closest('.quotation-date-filter-wrap') : null;
  if (!wrap) closeQuotationDateMenu();
});

/* ── QUOTATIONS TABLE ── */
function setQuotationMonitorFilter(status, btn) {
  const select = document.getElementById('filter-status');
  if (select) select.value = status;
  currentPage = 1;
  renderTable();
}

function getQuotationOverviewScope() {
  const search=(document.getElementById('search-input')?.value || '').trim().toLowerCase();
  const fCust=document.getElementById('filter-customer')?.value || '';
  const fFrom=document.getElementById('filter-date-from')?.value || '';
  const fTo=document.getElementById('filter-date-to')?.value || '';
  return quotations.filter(q=>{
    if(fCust && q.company!==fCust) return false;
    if(fFrom && q.date < fFrom) return false;
    if(fTo && q.date > fTo) return false;
    if(search) {
      const headerText = `${q.qno||''} ${q.company||''} ${q.contact||''} ${q.ref||''} ${q.notes||''}`.toLowerCase();
      const itemsText = (q.items||[]).map(it => `${it.desc||''} ${it.brand||''} ${it.model||''} ${it.code||''} ${it.specs||''} ${it.uom||''}`).join(' ').toLowerCase();
      if (!headerText.includes(search) && !itemsText.includes(search)) return false;
    }
    return true;
  });
}

function updateQuotationFilterHighlights() {
  const status=document.getElementById('filter-status')?.value || '';
  const customer=document.getElementById('filter-customer')?.value || '';
  const sort=document.getElementById('filter-sort')?.value || 'date-desc';
  const search=(document.getElementById('search-input')?.value || '').trim();
  const from=document.getElementById('filter-date-from')?.value || '';
  const to=document.getElementById('filter-date-to')?.value || '';

  const customerEl=document.getElementById('filter-customer');
  const sortEl=document.getElementById('filter-sort');
  const searchEl=document.getElementById('search-input');
  if(customerEl) customerEl.classList.toggle('filter-active', !!customer);
  if(sortEl) sortEl.classList.toggle('filter-active', sort !== 'date-desc');
  if(searchEl) searchEl.classList.toggle('filter-active', !!search);

  document.querySelectorAll('#page-quotations .quotation-monitor-item, #page-quotations .quotation-overview-total-btn').forEach(item => item.classList.remove('active'));
  const target = status
    ? document.querySelector(`#page-quotations .quotation-monitor-item[onclick*="'${status}'"]`)
    : document.querySelector('#page-quotations .quotation-overview-total-btn');
  if(target) target.classList.add('active');
  updateQuotationOverviewTint();

  const clearBtn=document.getElementById('quotation-clear-filters-btn');
  const hasActive=!!(status || customer || search || from || to || sort !== 'date-desc');
  if(clearBtn){
    clearBtn.classList.toggle('active', hasActive);
    clearBtn.disabled=!hasActive;
    clearBtn.setAttribute('aria-disabled', hasActive ? 'false' : 'true');
  }
}

function clearAllQuotationFilters() {
  const status=document.getElementById('filter-status');
  const customer=document.getElementById('filter-customer');
  const search=document.getElementById('search-input');
  const sort=document.getElementById('filter-sort');
  const from=document.getElementById('filter-date-from');
  const to=document.getElementById('filter-date-to');
  if(status) status.value='';
  if(customer) customer.value='';
  if(search) search.value='';
  if(sort) sort.value='date-desc';
  if(from) from.value='';
  if(to) to.value='';
  updateQuotationDateFilterUI('All Dates','all');
  closeQuotationDateMenu();
  currentPage=1;
  renderTable();
}

/* ── v119 Quotation Register Excel Export ───────────────────────────────
   Pilot export standard: one quotation = one Excel row.
   Exports the complete FILTERED register scope (not only the visible page).
   This is intentionally kept separate from full-system backup/export. */
function getQuotationRegisterExportRows(){
  const search=(document.getElementById('search-input')?.value || '').trim().toLowerCase();
  const fStatus=document.getElementById('filter-status')?.value || '';
  const fCust=document.getElementById('filter-customer')?.value || '';
  const fSort=document.getElementById('filter-sort')?.value || 'date-desc';
  const fFrom=document.getElementById('filter-date-from')?.value || '';
  const fTo=document.getElementById('filter-date-to')?.value || '';

  let rows=quotations.filter(q=>{
    if(fStatus && q.status!==fStatus) return false;
    if(fCust && q.company!==fCust) return false;
    const qDate=normalizedQuotationDate(q);
    if(fFrom && qDate < fFrom) return false;
    if(fTo && qDate > fTo) return false;
    if(search){
      const headerText=`${q.qno||''} ${q.company||''} ${q.contact||''} ${q.ref||''} ${q.notes||''}`.toLowerCase();
      const itemsText=(q.items||[]).map(it=>`${it.desc||''} ${it.brand||''} ${it.model||''} ${it.code||''} ${it.specs||''} ${it.uom||''}`).join(' ').toLowerCase();
      if(!headerText.includes(search) && !itemsText.includes(search)) return false;
    }
    return true;
  });

  if(fSort==='date-desc') rows.sort((a,b)=>normalizedQuotationDate(b).localeCompare(normalizedQuotationDate(a)));
  else if(fSort==='date-asc') rows.sort((a,b)=>normalizedQuotationDate(a).localeCompare(normalizedQuotationDate(b)));
  else if(fSort==='amount-desc') rows.sort((a,b)=>calcQuote(b).net-calcQuote(a).net);
  else if(fSort==='amount-asc') rows.sort((a,b)=>calcQuote(a).net-calcQuote(b).net);

  return sortRegisterRows(rows,'quotation',{
    no:q=>q.qno,date:q=>normalizedQuotationDate(q),customer:q=>q.company,reference:q=>q.ref,
    items:q=>(q.items||[]).length,amount:q=>calcQuote(q).net,status:q=>q.status,
    salesorders:q=>salesOrders.filter(x=>x.quotationId===q.id).map(x=>x.soNo).join(' '),valid:q=>validUntil(q)
  });
}

function quotationExportFilterSummary(){
  const parts=[];
  const status=document.getElementById('filter-status')?.value || '';
  const customer=document.getElementById('filter-customer')?.value || '';
  const search=(document.getElementById('search-input')?.value || '').trim();
  const from=document.getElementById('filter-date-from')?.value || '';
  const to=document.getElementById('filter-date-to')?.value || '';
  if(status) parts.push(`Status: ${status}`);
  if(customer) parts.push(`Customer: ${customer}`);
  if(from || to) parts.push(`Date: ${from||'Beginning'} to ${to||'Latest'}`);
  if(search) parts.push(`Search: ${search}`);
  return parts.length ? parts.join(' | ') : 'All quotations';
}

function openQuotationExcelExportDialog(){
  const rows=getQuotationRegisterExportRows();
  if(!rows.length){
    showToast('No quotations match the current filters. Nothing to export.','warning');
    return;
  }
  document.getElementById('quotation-export-overlay')?.remove();
  const overlay=document.createElement('div');
  overlay.id='quotation-export-overlay';
  overlay.className='confirm-overlay quotation-export-overlay';
  overlay.innerHTML=`
    <div class="confirm-box quotation-export-box" role="dialog" aria-modal="true" aria-labelledby="quotation-export-title">
      <div class="confirm-icon"><i class="ti ti-file-spreadsheet"></i></div>
      <div class="confirm-title" id="quotation-export-title">Export Quotation Register</div>
      <div class="confirm-msg">Choose the level of detail to include in the Excel workbook.</div>
      <div class="quotation-export-options">
        <label class="quotation-export-option">
          <input type="radio" name="quotation-export-scope" value="summary">
          <span><strong>Quotation Summary Only</strong><small>One row per quotation in the Quotation Register sheet.</small></span>
        </label>
        <label class="quotation-export-option selected">
          <input type="radio" name="quotation-export-scope" value="lines" checked>
          <span><strong>Summary + Line Items</strong><small>Adds a separate Quotation Line Items worksheet linked by quotation number.</small></span>
        </label>
      </div>
      <div class="quotation-export-count"><i class="ti ti-filter"></i><strong>${rows.length}</strong> quotation${rows.length===1?'':'s'} will be exported based on the current filters.</div>
      <div class="confirm-btns">
        <button class="btn btn-secondary" id="quotation-export-cancel">Cancel</button>
        <button class="btn btn-primary" id="quotation-export-confirm"><i class="ti ti-file-spreadsheet"></i> Export Excel</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const options=[...overlay.querySelectorAll('.quotation-export-option')];
  options.forEach(label=>label.addEventListener('click',()=>{
    options.forEach(x=>x.classList.remove('selected'));
    label.classList.add('selected');
  }));
  const close=()=>overlay.remove();
  overlay.querySelector('#quotation-export-cancel').onclick=close;
  overlay.querySelector('#quotation-export-confirm').onclick=()=>{
    const includeLines=overlay.querySelector('input[name="quotation-export-scope"]:checked')?.value==='lines';
    close();
    exportQuotationRegisterExcel(includeLines, rows);
  };
  overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
  const esc=e=>{if(e.key==='Escape'&&document.getElementById('quotation-export-overlay')){close();document.removeEventListener('keydown',esc);}};
  document.addEventListener('keydown',esc);
  setTimeout(()=>overlay.querySelector('#quotation-export-confirm')?.focus(),50);
}

function buildQuotationLineItemRows(rows){
  const output=[];
  rows.forEach(q=>{
    let itemLine=0;
    (q.items||[]).forEach((it,index)=>{
      const rowType=it.lineType==='heading'?'Heading':it.lineType==='note'?'Note':'Item';
      if(rowType==='Item') itemLine++;
      const qty=rowType==='Item'?(Number(it.qty)||0):'';
      const unitPrice=rowType==='Item'?(Number(it.up)||0):'';
      const amount=rowType==='Item'?qty*unitPrice:'';
      output.push([
        q.qno||'', normalizedQuotationDate(q), q.company||'', q.ref||'', rowType,
        rowType==='Item'?itemLine:'', index+1, it.code||'',
        rowType==='Item'?(it.desc||''):(it.text||it.desc||''), it.brand||'', it.model||'', it.specs||'',
        qty, it.uom||'', unitPrice, rowType==='Item'?vatRate(q):'', amount
      ]);
    });
  });
  return output;
}

function exportQuotationRegisterExcel(includeLines=false, prefetchedRows=null){
  if(typeof XLSX==='undefined'){
    showToast('Excel library is not available. Check your internet connection and try again.','error');
    return;
  }
  const rows=prefetchedRows||getQuotationRegisterExportRows();
  if(!rows.length){
    showToast('No quotations match the current filters. Nothing to export.','warning');
    return;
  }
  try{
    const now=new Date();
    const exportedAt=now.toLocaleString();
    const companyName=settings?.coname || 'BizCore';
    const headers=['Quotation No.','Date','Customer','Contact','Reference / RFQ','Project','Status','Revision','Validity (Days)','Valid Until','Items','Subtotal','Discount','VAT Rate %','VAT Amount','Net Amount','Sales Orders','Payment Terms','Delivery Terms'];
    const data=rows.map(q=>{
      const c=calcQuote(q);
      const linkedSOs=salesOrders.filter(x=>x.quotationId===q.id).map(x=>x.soNo).filter(Boolean).join(', ');
      return [
        q.qno||'', normalizedQuotationDate(q), q.company||'', q.contact||'', q.ref||'', q.project||'', q.status||'',
        Number(q.revisionNo)||0, Number(q.validity)||7, validUntil(q), (q.items||[]).filter(i=>!i.lineType||i.lineType==='item').length,
        c.sub, c.disc, vatRate(q), c.vat, c.net, linkedSOs, q.payment||'', q.delivery||''
      ];
    });
    const aoa=[
      [`${companyName} — Quotation Register`],
      [`Exported: ${exportedAt}`],
      [`Filters: ${quotationExportFilterSummary()}`],
      [`Records: ${rows.length}`],
      [], headers, ...data
    ];
    const ws=XLSX.utils.aoa_to_sheet(aoa, {cellDates:false});
    ws['!cols']=[
      {wch:20},{wch:13},{wch:30},{wch:22},{wch:22},{wch:24},{wch:13},{wch:10},{wch:14},{wch:13},{wch:9},
      {wch:16},{wch:14},{wch:12},{wch:14},{wch:16},{wch:24},{wch:24},{wch:28}
    ];
    ws['!autofilter']={ref:`A6:S${rows.length+6}`};
    ws['!freeze']={xSplit:0,ySplit:6,topLeftCell:'A7',activePane:'bottomLeft',state:'frozen'};
    for(let r=7;r<=rows.length+6;r++){
      ['L','M','O','P'].forEach(col=>{ if(ws[`${col}${r}`]) ws[`${col}${r}`].z='#,##0.00'; });
      if(ws[`N${r}`]) ws[`N${r}`].z='0.00';
    }
    const wb=XLSX.utils.book_new();
    wb.Props={Title:'BizCore Quotation Register',Subject:includeLines?'Quotation register and line item export':'Quotation register export',Author:companyName,CreatedDate:now};
    XLSX.utils.book_append_sheet(wb,ws,'Quotation Register');

    let lineCount=0;
    if(includeLines){
      const lineHeaders=['Quotation No.','Quotation Date','Customer','Reference / RFQ','Row Type','Item Line','Sort Order','Item Code','Description / Text','Brand','Model','Specifications','Qty','UOM','Unit Price','VAT Rate %','Line Amount'];
      const lineRows=buildQuotationLineItemRows(rows);
      lineCount=lineRows.length;
      const lineAoa=[
        [`${companyName} — Quotation Line Items`],
        [`Exported: ${exportedAt}`],
        [`Filters: ${quotationExportFilterSummary()}`],
        [`Quotations: ${rows.length} | Rows: ${lineRows.length}`],
        [], lineHeaders, ...lineRows
      ];
      const lineWs=XLSX.utils.aoa_to_sheet(lineAoa,{cellDates:false});
      lineWs['!cols']=[{wch:20},{wch:14},{wch:30},{wch:22},{wch:12},{wch:10},{wch:10},{wch:16},{wch:48},{wch:18},{wch:18},{wch:34},{wch:12},{wch:10},{wch:15},{wch:12},{wch:16}];
      lineWs['!autofilter']={ref:`A6:Q${lineRows.length+6}`};
      lineWs['!freeze']={xSplit:0,ySplit:6,topLeftCell:'A7',activePane:'bottomLeft',state:'frozen'};
      for(let r=7;r<=lineRows.length+6;r++){
        ['M','O','Q'].forEach(col=>{if(lineWs[`${col}${r}`]) lineWs[`${col}${r}`].z='#,##0.00';});
        if(lineWs[`P${r}`]) lineWs[`P${r}`].z='0.00';
      }
      XLSX.utils.book_append_sheet(wb,lineWs,'Quotation Line Items');
    }

    const dateStamp=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    XLSX.writeFile(wb,`BizCore_Quotation_Register_${dateStamp}.xlsx`,{compression:true});
    const suffix=includeLines?` with ${lineCount} line-item row${lineCount===1?'':'s'}`:'';
    showToast(`${rows.length} quotation${rows.length===1?'':'s'} exported${suffix}.`,'success');
  }catch(err){
    console.error('Quotation Excel export failed:',err);
    showToast('Could not create the quotation Excel export. Please try again.','error');
  }
}

function updateQuotationMonitor() {
  const scoped = getQuotationOverviewScope();
  const counts = {all: scoped.length, Draft:0, Sent:0, Won:0, Lost:0, Expired:0, Revised:0, Cancelled:0};
  scoped.forEach(q => { if (Object.prototype.hasOwnProperty.call(counts, q.status)) counts[q.status]++; });
  const map = {
    all:'quote-kpi-all', Draft:'quote-kpi-draft', Sent:'quote-kpi-sent', Won:'quote-kpi-won', Lost:'quote-kpi-lost',
    Expired:'quote-kpi-expired', Revised:'quote-kpi-revised', Cancelled:'quote-kpi-cancelled'
  };
  Object.entries(map).forEach(([key,id]) => { const el=document.getElementById(id); if(el) el.textContent=counts[key]||0; });
  const decided = counts.Won + counts.Lost;
  const winRateEl = document.getElementById('quote-kpi-winrate');
  if (winRateEl) winRateEl.textContent = decided ? `${Math.round((counts.Won / decided) * 100)}%` : '—';
  const avgValueEl = document.getElementById('quote-kpi-avgvalue');
  if (avgValueEl) {
    const avgValue = scoped.length ? scoped.reduce((sum,q)=>sum + (calcQuote(q).net || 0),0) / scoped.length : 0;
    avgValueEl.textContent = scoped.length ? `SAR ${Math.round(avgValue).toLocaleString()}` : '—';
  }
  updateQuotationFilterHighlights();
}

function resetQuotationRegisterFiltersForNewRecord(){
  const search=document.getElementById('search-input');
  const status=document.getElementById('filter-status');
  const customer=document.getElementById('filter-customer');
  const from=document.getElementById('filter-date-from');
  const to=document.getElementById('filter-date-to');
  if(search)search.value='';
  if(status)status.value='';
  if(customer)customer.value='';
  if(from)from.value='';
  if(to)to.value='';
  currentPage=1;
  if(typeof quotationMonitorFilter!=='undefined') quotationMonitorFilter='all';
  document.querySelectorAll('#page-quotations .quotation-monitor-item, #page-quotations [data-overview-key]')
    .forEach(el=>el.classList.remove('active'));
  document.querySelector('#page-quotations [data-overview-key="all"]')?.classList.add('active');
}

function renderTable() {
  document.querySelectorAll('.rows-per-page-select').forEach(el=>{ if(el.value!=String(PER_PAGE)) el.value = String(PER_PAGE); });
  const search=document.getElementById('search-input').value.toLowerCase();
  const fStatus=document.getElementById('filter-status').value;
  const fCust=document.getElementById('filter-customer').value;
  const fSort=document.getElementById('filter-sort').value;

  const custSet=[...new Set(quotations.map(q=>q.company))].sort();
  const sel=document.getElementById('filter-customer');
  const prev=sel.value;
  sel.innerHTML='<option value="">All customers</option>'+custSet.map(c=>`<option${c===prev?' selected':''}>${c}</option>`).join('');

  updateQuotationMonitor();

  const fFrom = document.getElementById('filter-date-from').value;
  const fTo   = document.getElementById('filter-date-to').value;
  // show/hide clear button
  const legacyDateClear = document.getElementById('date-clear-btn');
  if (legacyDateClear) legacyDateClear.style.display = (fFrom||fTo) ? 'inline-flex' : 'none';

  let filtered=quotations.filter(q=>{
    if(fStatus && q.status!==fStatus) return false;
    if(fCust && q.company!==fCust) return false;
    if(fFrom && q.date < fFrom) return false;
    if(fTo   && q.date > fTo)   return false;
    if(search) {
      // Search header fields
      const headerText = `${q.qno} ${q.company} ${q.contact} ${q.ref} ${q.notes}`.toLowerCase();
      // Search inside all line items — description, brand, model, code, specs
      const itemsText = (q.items||[]).map(it =>
        `${it.desc||''} ${it.brand||''} ${it.model||''} ${it.code||''} ${it.specs||''} ${it.uom||''}`
      ).join(' ').toLowerCase();
      if (!headerText.includes(search) && !itemsText.includes(search)) return false;
    }
    return true;
  });
  if(fSort==='date-desc') filtered.sort((a,b)=>b.date.localeCompare(a.date));
  else if(fSort==='date-asc') filtered.sort((a,b)=>a.date.localeCompare(b.date));
  else if(fSort==='amount-desc') filtered.sort((a,b)=>calcQuote(b).net-calcQuote(a).net);
  else if(fSort==='amount-asc') filtered.sort((a,b)=>calcQuote(a).net-calcQuote(b).net);
  filtered=sortRegisterRows(filtered,'quotation',{no:q=>q.qno,date:q=>normalizedQuotationDate(q),customer:q=>q.company,reference:q=>q.ref,items:q=>(q.items||[]).length,amount:q=>calcQuote(q).net,status:q=>q.status,salesorders:q=>salesOrders.filter(x=>x.quotationId===q.id).map(x=>x.soNo).join(' '),valid:q=>validUntil(q)});

  const fFrom2 = document.getElementById('filter-date-from').value;
  const fTo2   = document.getElementById('filter-date-to').value;
  let countLabel = `${filtered.length} quotation${filtered.length!==1?'s':''}`;
  if (fFrom2 || fTo2) {
    const range = [fFrom2, fTo2].filter(Boolean).map(fmtDate).join(' → ');
    countLabel += ` · ${range}`;
  }
  document.getElementById('q-count').textContent = countLabel;
  const pages=Math.ceil(filtered.length/PER_PAGE)||1;
  if(currentPage>pages) currentPage=1;
  const slice=filtered.slice((currentPage-1)*PER_PAGE,currentPage*PER_PAGE);

  document.getElementById('quotes-tbody').innerHTML=slice.length?slice.map(q=>{
   try {
    const {net}=calcQuote(q);
    const vu=validUntil(q);
    const isExpiring=q.status==='Sent'&&new Date(vu)<new Date(Date.now()+3*86400000);
    // Check if search matched a line item (not just header)
    const headerMatch = search ? `${q.qno} ${q.company} ${q.contact} ${q.ref} ${q.notes}`.toLowerCase().includes(search) : true;
    const matchedItems = search && !headerMatch
      ? (q.items||[]).filter(it => `${it.desc||''} ${it.brand||''} ${it.model||''} ${it.code||''} ${it.specs||''}`.toLowerCase().includes(search))
      : [];
    const itemMatchBadge = matchedItems.length
      ? `<br><span style="font-size:10px;background:#fff3cd;color:#856404;border-radius:3px;padding:1px 5px;margin-top:2px;display:inline-block">
           <i class="ti ti-search" style="font-size:9px"></i> matched in: ${matchedItems.slice(0,2).map(it=>it.desc||it.code||'item').join(', ')}${matchedItems.length>2?' +more':''}
         </span>` : '';
    const linkedSOs = salesOrders.filter(s=>s.quotationId===q.id);
    const soChips = linkedSOs.map(so => {
      const soSt = getSOStatus(so);
      const soStBadge = {'Confirmed':'🔵','Delivered':'🟣','Invoiced':'🟠','Paid':'🟢','Partially Paid':'🟡'}[soSt]||'🔵';
      return `<a href="#" class="so-chip" onclick="event.stopPropagation();navigateToSO('${so.id}');return false" title="Status: ${soSt}">${soStBadge} ${so.soNo}</a>`;
    }).join('');
    const qCellStyle = 'font-size:14px!important;font-weight:400!important;color:#111827!important;line-height:1.35!important';
    return `<tr class="quotation-clickable-row" tabindex="0" role="button" aria-label="Open quotation ${q.qno}" onclick="viewQuotation('${q.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();viewQuotation('${q.id}');}">
      <td class="rfq-cell-no quotation-cell-regular" style="${qCellStyle}">${q.qno}</td>
      <td class="mob-hide rfq-cell-muted" style="${qCellStyle}">${fmtDate(normalizedQuotationDate(q))}</td>
      <td class="rfq-cell-customer quotation-cell-regular" style="${qCellStyle}">${q.company}${itemMatchBadge}</td>
      <td class="mob-hide" style="${qCellStyle}">${q.ref||'—'}</td>
      <td class="mob-hide center" style="${qCellStyle}">${(q.items||[]).length}</td>
      <td class="right" style="${qCellStyle}">${formatNumber(net,2)}</td>
      <td style="${qCellStyle}"><span class="badge ${getStatusClass(q.status)}" style="font-size:14px!important;font-weight:400!important">${q.status}</span></td>
      <td class="mob-hide" style="${qCellStyle}">${soChips ? `<div style="display:flex;flex-direction:column;gap:3px;${qCellStyle}">${soChips}</div>` : `<span style="${qCellStyle}">—</span>`}</td>
      <td class="mob-hide" style="${qCellStyle}">${fmtDate(vu)}</td>
    </tr>`;
   } catch(err) {
    console.error('Skipped a quotation row that failed to render:', q && q.qno, err);
    return `<tr><td colspan="9" style="color:#b91c1c;font-size:12px">⚠ Could not display quotation ${q&&q.qno?q.qno:'(unknown)'} — data may be incomplete.</td></tr>`;
   }
  }).join(''):`<tr><td colspan="9"><div class="empty-state"><i class="ti ti-file-off"></i><strong>No quotations found</strong><p>Adjust your filters or create a new quotation.</p></div></td></tr>`;

  document.getElementById('pagination').innerHTML = buildPaginationHTML(currentPage, pages, 'goPage');
}
function goPage(p){currentPage=p;renderTable();}

/* ── CUSTOMERS LIST ── */
function renderCustomers() {
  const search=document.getElementById('cust-search').value.toLowerCase();
  const stats={};
  customers.forEach(c=>stats[c.id]={count:0,total:0,won:0});
  quotations.forEach(q=>{
    const c=(q.custId&&customers.find(x=>String(x.id)===String(q.custId)))||(!q.custId?findUniqueMasterByName(customers,q.company):null);
    if(!c)return;
    const st=stats[c.id]||(stats[c.id]={count:0,total:0,won:0});
    st.count++;
    st.total+=calcQuote(q).net;
    if(q.status==='Won') st.won+=calcQuote(q).net;
  });
  const list=customers.filter(c=>!search||c.company.toLowerCase().includes(search)||
    (c.contact||'').toLowerCase().includes(search));
  const sortedList=sortRegisterRows(list,'customers',{company:c=>c.company,contact:c=>{const a=c.contacts||(c.contact?[{name:c.contact}]:[]);return (a.find(x=>x.isDefault)||a[0]||{}).name||''},title:c=>{const a=c.contacts||[];return (a.find(x=>x.isDefault)||a[0]||{}).title||''},city:c=>c.city,phone:c=>{const a=c.contacts||[];return (a.find(x=>x.isDefault)||a[0]||{}).phone||c.phone||''},quotes:c=>(stats[c.id]||{}).count||0,total:c=>(stats[c.id]||{}).total||0});
  const customerPages=Math.ceil(sortedList.length/PER_PAGE)||1;
  if(customerPage>customerPages) customerPage=1;
  const customerSlice=sortedList.slice((customerPage-1)*PER_PAGE,customerPage*PER_PAGE);
  masterVisiblePageIds.customers = customerSlice.map(c=>c.id);
  document.querySelectorAll('.rows-per-page-select').forEach(el=>{ if(el.value!=String(PER_PAGE)) el.value=String(PER_PAGE); });
  document.getElementById('customers-tbody').innerHTML=customerSlice.length?customerSlice.map(c=>{
    const selected = masterSelection.customers.has(c.id);
    const s=stats[c.id]||{count:0,total:0,won:0};
    const contacts = c.contacts || (c.contact ? [{name:c.contact,title:'',phone:c.phone||''}] : []);
    const defaultCt = contacts.find(x=>x.isDefault) || contacts[0];
    const extraCount = contacts.length > 1 ? `<span style="font-size:10px;background:var(--blue-pale);color:var(--blue);border-radius:10px;padding:1px 6px;margin-left:4px">+${contacts.length-1} more</span>` : '';
    return `<tr class="master-clickable-row${selected?' master-row-selected':''}" data-master-type="customers" data-master-id="${c.id}" tabindex="0" role="button" aria-label="Open customer ${c.company}" onclick="viewCustomer('${c.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();viewCustomer('${c.id}');}">
      <td class="master-select-col" onclick="event.stopPropagation()"><input class="master-row-check" type="checkbox" ${selected?'checked':''} onkeydown="event.stopPropagation()" aria-label="Select ${c.company}" onchange="toggleMasterSelection('customers','${c.id}',this.checked)"></td>
      <td><strong>${c.company}</strong></td>
      <td>${defaultCt?.name||'—'}${extraCount}</td>
      <td>${defaultCt?.title||'—'}</td>
      <td>${c.city||'—'}</td>
      <td>${defaultCt?.phone||'—'}</td>
      <td class="center">${s.count}</td>
      <td class="right" style="font-weight:600">${s.total>0?fmtShort(s.total):'—'}</td>
    </tr>`;
  }).join(''):`<tr><td colspan="8"><div class="empty-state"><i class="ti ti-users-off"></i><p>No customers found.</p></div></td></tr>`;
  const cp=document.getElementById('customers-pagination'); if(cp) cp.innerHTML=buildPaginationHTML(customerPage,customerPages,'goCustomerPage');
  updateMasterSelectionUI('customers');
}
function goCustomerPage(p){customerPage=p;renderCustomers();}

function renderSetupCustTable() {
  const tbody=document.getElementById('setup-cust-tbody');
  if(!tbody) return;
  tbody.innerHTML=customers.map(c=>`
    <tr><td>${c.company}</td><td>${c.city||'—'}</td>
    <td><div class="action-btns">
      <button class="abtn abtn-edit btn-sm" onclick="openEditCustomer('${c.id}')"><i class="ti ti-edit"></i>Edit</button>
      <button class="abtn abtn-del btn-sm" onclick="deleteCustomer('${c.id}')"><i class="ti ti-trash"></i></button>
    </div></td></tr>`).join('');
}

/* ── ANALYTICS ── */
function renderAnalytics() {
  const won=quotations.filter(q=>q.status==='Won');
  const closed=quotations.filter(q=>q.status==='Won'||q.status==='Lost');
  const wr=closed.length?Math.round(won.length/closed.length*100):0;
  const avg=quotations.length?quotations.reduce((s,q)=>s+calcQuote(q).net,0)/quotations.length:0;
  const yr=new Date().getFullYear();
  const ytd=won.filter(q=>q.date&&q.date.startsWith(yr)).reduce((s,q)=>s+calcQuote(q).net,0);
  document.getElementById('an-winrate').textContent=wr+'%';
  document.getElementById('an-avg').textContent=fmtShort(avg);
  document.getElementById('an-ytd').textContent=fmtShort(ytd);

  const custMap={};
  quotations.forEach(q=>{
    if(!custMap[q.company]) custMap[q.company]={total:0,won:0};
    custMap[q.company].total+=calcQuote(q).net;
    if(q.status==='Won') custMap[q.company].won+=calcQuote(q).net;
  });
  document.getElementById('top-cust-tbody').innerHTML=Object.entries(custMap).sort((a,b)=>b[1].total-a[1].total).slice(0,8)
    .map(([n,v])=>`<tr><td>${n}</td><td class="right">${fmtShort(v.total)}</td><td class="right" style="color:var(--green);font-weight:500">${fmtShort(v.won)}</td></tr>`).join('');

  const statuses=['Draft','Sent','Won','Lost','Expired','Revised','Cancelled'];
  const colors={Draft:'#6c757d',Sent:'#185FA5',Won:'#1e7e34',Lost:'#c0392b',Expired:'#e67e22',Revised:'#6f42c1',Cancelled:'#9CA3AF'};
  const tot=quotations.length||1;
  document.getElementById('an-status-chart').innerHTML=statuses.map(s=>{
    const cnt=quotations.filter(q=>q.status===s).length;
    const pct=Math.round(cnt/tot*100);
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><div style="width:70px;font-size:12px">${s}</div><div style="flex:1;background:#f0f0f0;border-radius:3px;height:16px"><div style="width:${pct}%;height:100%;background:${colors[s]};border-radius:3px"></div></div><div style="width:30px;font-size:12px;text-align:right;font-weight:600">${cnt}</div><div style="width:32px;font-size:11px;color:var(--gray)">${pct}%</div></div>`;
  }).join('');
}

/* ── NAVIGATION ── */
function getNavGroups(){ return Array.from(document.querySelectorAll('.nav-group')); }
function setNavGroupState(group, open, persist=true){
  if(!group) return;
  group.classList.toggle('open', !!open);
  const toggle=group.querySelector(':scope > .nav-group-toggle');
  if(toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  if(persist){
    const openGroup=getNavGroups().find(g=>g.classList.contains('open'));
    try{localStorage.setItem('bc_nav_open_group',openGroup?.dataset.group||'');}catch(e){}
  }
}
function toggleNavGroup(toggleEl) {
  const group=toggleEl.closest('.nav-group');
  if(!group) return;
  const sidebar=document.querySelector('.sidebar');
  if(sidebar?.classList.contains('collapsed') && !window.matchMedia('(max-width:900px)').matches){
    toggleCollapsedNavFlyout(group,toggleEl);
    return;
  }
  closeCollapsedNavFlyout();
  const willOpen=!group.classList.contains('open');
  getNavGroups().forEach(g=>setNavGroupState(g,g===group?willOpen:false,false));
  try{localStorage.setItem('bc_nav_open_group',willOpen?(group.dataset.group||''):'');}catch(e){}
}
function openNavGroupForItem(el) {
  const group=el ? el.closest('.nav-group') : null;
  if(!group) return;
  getNavGroups().forEach(g=>setNavGroupState(g,g===group,false));
  try{localStorage.setItem('bc_nav_open_group',group.dataset.group||'');}catch(e){}
}
function refreshNavGroupHighlight(){
  getNavGroups().forEach(g=>g.classList.toggle('active-group',!!g.querySelector('.nav-item.active')));
}
function setActiveMenuItem(el) {
  document.querySelectorAll('.nav-item').forEach(n=>{n.classList.remove('active');n.setAttribute('aria-current','false');});
  if(el){el.classList.add('active');el.setAttribute('aria-current','page');openNavGroupForItem(el);}
  closeCollapsedNavFlyout();
  refreshNavGroupHighlight();
  try{if(el?.dataset.navPage)localStorage.setItem('bc_last_nav_page',el.dataset.navPage);}catch(e){}
}
function toggleSidebarCollapse(force){
  const sidebar=document.querySelector('.sidebar');
  if(!sidebar || window.matchMedia('(max-width:900px)').matches) return;
  const collapsed=typeof force==='boolean'?force:!sidebar.classList.contains('collapsed');
  sidebar.classList.toggle('collapsed',collapsed);
  closeCollapsedNavFlyout();
  const btn=document.getElementById('sidebar-collapse-btn');
  if(btn){
    btn.setAttribute('aria-expanded',collapsed?'false':'true');
    btn.setAttribute('aria-label',collapsed?'Expand sidebar':'Collapse sidebar');
    btn.title=collapsed?'Expand sidebar':'Collapse sidebar';
    btn.innerHTML=collapsed?'<i class="ti ti-chevron-right"></i>':'<i class="ti ti-chevron-left"></i>';
  }
  try{localStorage.setItem('bc_sidebar_collapsed',collapsed?'1':'0');}catch(e){}
}
function getVisibleNavControls(){
  return Array.from(document.querySelectorAll('.nav-item.nav-root,.nav-group-toggle,.nav-group.open .nav-submenu .nav-item'))
    .filter(el=>el.offsetParent!==null && getComputedStyle(el).visibility!=='hidden');
}
function handleSidebarKeydown(e){
  const current=e.target.closest('.nav-item,.nav-group-toggle');
  if(!current) return;
  const controls=getVisibleNavControls();
  const idx=controls.indexOf(current);
  if(['Enter',' '].includes(e.key)){e.preventDefault();current.click();return;}
  if(e.key==='ArrowDown'){e.preventDefault();controls[(idx+1)%controls.length]?.focus();}
  else if(e.key==='ArrowUp'){e.preventDefault();controls[(idx-1+controls.length)%controls.length]?.focus();}
  else if(e.key==='Home'){e.preventDefault();controls[0]?.focus();}
  else if(e.key==='End'){e.preventDefault();controls[controls.length-1]?.focus();}
  else if(e.key==='ArrowRight' && current.classList.contains('nav-group-toggle')){
    e.preventDefault();const group=current.closest('.nav-group');
    const sidebar=document.querySelector('.sidebar');
    if(sidebar?.classList.contains('collapsed')&&!window.matchMedia('(max-width:900px)').matches){openCollapsedNavFlyout(group,current,true);}
    else if(!group.classList.contains('open')) toggleNavGroup(current); else group.querySelector('.nav-submenu .nav-item')?.focus();
  }else if(e.key==='ArrowLeft'){
    const group=current.closest('.nav-group');
    if(group?.classList.contains('open')){e.preventDefault();setNavGroupState(group,false);group.querySelector('.nav-group-toggle')?.focus();}
  }
}

/* Collapsed sidebar module flyout */
let collapsedNavFlyoutGroup=null;
function getCollapsedNavFlyout(){
  let flyout=document.getElementById('sidebar-nav-flyout');
  if(!flyout){
    flyout=document.createElement('div');
    flyout.id='sidebar-nav-flyout';
    flyout.className='sidebar-flyout';
    flyout.setAttribute('role','menu');
    flyout.setAttribute('aria-hidden','true');
    document.body.appendChild(flyout);
  }
  return flyout;
}
function buildCollapsedNavFlyout(group){
  const flyout=getCollapsedNavFlyout();
  const toggle=group.querySelector(':scope > .nav-group-toggle');
  const label=toggle?.getAttribute('aria-label')||group.dataset.group||'Menu';
  const iconClass=toggle?.querySelector(':scope > i:first-child')?.className||'ti ti-folder';
  const items=Array.from(group.querySelectorAll(':scope > .nav-submenu > .nav-item'));
  flyout.innerHTML='<div class="sidebar-flyout-head"><i class="'+iconClass+'"></i><span>'+escapeHtml(label)+'</span></div><div class="sidebar-flyout-list">'+items.map((item,index)=>{
    const itemLabel=item.getAttribute('aria-label')||item.querySelector('.nav-text')?.textContent?.trim()||'Item';
    const itemIcon=item.querySelector(':scope > i')?.className||'ti ti-circle';
    const badgeHtml=Array.from(item.querySelectorAll('.nav-badge')).filter(b=>b.style.display!=='none' && b.textContent.trim()).map(b=>'<span class="'+b.className+'">'+escapeHtml(b.textContent.trim())+'</span>').join('');
    return '<button type="button" role="menuitem" class="sidebar-flyout-item '+(item.classList.contains('active')?'active':'')+'" data-flyout-index="'+index+'"><i class="'+itemIcon+'"></i><span class="flyout-label">'+escapeHtml(itemLabel)+'</span>'+badgeHtml+'</button>';
  }).join('')+'</div>';
  flyout.querySelectorAll('.sidebar-flyout-item').forEach((button,index)=>{
    button.addEventListener('click',()=>{
      const original=items[index];
      if(original) original.click();
      closeCollapsedNavFlyout();
    });
  });
  flyout.onkeydown=handleCollapsedFlyoutKeydown;
  return flyout;
}
function positionCollapsedNavFlyout(flyout,toggle){
  const rect=toggle.getBoundingClientRect();
  const gap=10;
  flyout.style.left=(rect.right+gap)+'px';
  flyout.style.top=Math.max(8,Math.min(rect.top-8,window.innerHeight-flyout.offsetHeight-8))+'px';
  const arrowTop=Math.max(14,Math.min(rect.top+rect.height/2-parseFloat(flyout.style.top)-6,flyout.offsetHeight-25));
  flyout.style.setProperty('--flyout-arrow-top',arrowTop+'px');
}
function openCollapsedNavFlyout(group,toggle,focusFirst=false){
  if(!group||!toggle)return;
  closeTopbarMenus?.();
  const flyout=buildCollapsedNavFlyout(group);
  collapsedNavFlyoutGroup=group;
  document.querySelectorAll('.nav-group.flyout-open').forEach(g=>g.classList.remove('flyout-open'));
  group.classList.add('flyout-open');
  flyout.classList.add('show');
  flyout.setAttribute('aria-hidden','false');
  toggle.setAttribute('aria-expanded','true');
  requestAnimationFrame(()=>{
    positionCollapsedNavFlyout(flyout,toggle);
    if(focusFirst) flyout.querySelector('.sidebar-flyout-item.active,.sidebar-flyout-item')?.focus();
  });
}
function closeCollapsedNavFlyout(returnFocus=false){
  const flyout=document.getElementById('sidebar-nav-flyout');
  const group=collapsedNavFlyoutGroup;
  if(flyout){flyout.classList.remove('show');flyout.setAttribute('aria-hidden','true');}
  if(group){
    group.classList.remove('flyout-open');
    group.querySelector(':scope > .nav-group-toggle')?.setAttribute('aria-expanded','false');
  }
  if(returnFocus) group?.querySelector(':scope > .nav-group-toggle')?.focus();
  collapsedNavFlyoutGroup=null;
}
function toggleCollapsedNavFlyout(group,toggle){
  const flyout=getCollapsedNavFlyout();
  if(collapsedNavFlyoutGroup===group && flyout.classList.contains('show')) closeCollapsedNavFlyout(true);
  else openCollapsedNavFlyout(group,toggle,false);
}
function handleCollapsedFlyoutKeydown(e){
  const flyout=e.currentTarget;
  const items=Array.from(flyout.querySelectorAll('.sidebar-flyout-item'));
  const current=document.activeElement;
  const index=items.indexOf(current);
  if(e.key==='Escape'||e.key==='ArrowLeft'){e.preventDefault();closeCollapsedNavFlyout(true);return;}
  if(e.key==='ArrowDown'){e.preventDefault();items[(index+1+items.length)%items.length]?.focus();}
  else if(e.key==='ArrowUp'){e.preventDefault();items[(index-1+items.length)%items.length]?.focus();}
  else if(e.key==='Home'){e.preventDefault();items[0]?.focus();}
  else if(e.key==='End'){e.preventDefault();items[items.length-1]?.focus();}
}
function initCollapsedNavFlyout(){
  getCollapsedNavFlyout();
  document.addEventListener('pointerdown',e=>{
    const flyout=document.getElementById('sidebar-nav-flyout');
    if(!flyout?.classList.contains('show'))return;
    if(flyout.contains(e.target)||e.target.closest('.nav-group-toggle'))return;
    closeCollapsedNavFlyout();
  });
  window.addEventListener('resize',()=>closeCollapsedNavFlyout());
  window.addEventListener('scroll',()=>closeCollapsedNavFlyout(),true);
}

function initPremiumSidebar(){
  const sidebar=document.querySelector('.sidebar');
  if(!sidebar) return;
  sidebar.addEventListener('keydown',handleSidebarKeydown);
  initCollapsedNavFlyout();
  let savedGroup=''; let collapsed=false;
  try{savedGroup=localStorage.getItem('bc_nav_open_group')||'';collapsed=localStorage.getItem('bc_sidebar_collapsed')==='1';}catch(e){}
  const activeGroup=document.querySelector('.nav-item.active')?.closest('.nav-group');
  const desired=activeGroup?.dataset.group||savedGroup||'sales';
  getNavGroups().forEach(g=>setNavGroupState(g,g.dataset.group===desired,false));
  refreshNavGroupHighlight();
  toggleSidebarCollapse(collapsed);
}
function openAdministration(tab, title, el) {
  showPage('setup', null);
  if(typeof switchSetupTab==='function' && document.getElementById('stab-'+tab)) switchSetupTab(tab);
  setActiveMenuItem(el);
  document.getElementById('page-title').textContent=title;
  closeMobileSidebar();
}
function showPlannedModule(title, el) {
  setActiveMenuItem(el);
  document.getElementById('page-title').textContent=title;
  alert(title+' is included in the BizCore menu and will be developed in the next phase.');
  closeMobileSidebar();
}


let pricingDocumentFilter='all';
let pricingDateFilter={preset:'all',from:'',to:''};
function getPricingDocuments(){
  const docs=[];
  rfqs.forEach(r=>{
    ensurePricingVersions(r).forEach((v,index)=>{
      if(!Array.isArray(v.pricingItems)||!v.pricingItems.length)return;
      const version=Number(v.version)||index+1;
      const status=v.status==='Converted'?'Converted':(v.status==='Superseded'?'Converted':'Saved');
      const quote=quotations.find(q=>q.id===v.quotationId || q.qno===v.quotationId)
        || (version===Number(r.currentPricingVersion)&&r.quotationId
          ? quotations.find(q=>q.id===r.quotationId || q.qno===r.quotationId)
          : null);
      const items=v.pricingItems||[];
      const material=items.reduce((sum,it)=>sum+(Number(it.buy)||0)*(Number(it.qty)||0),0);
      const extras=(v.internalCosts||[]).reduce((sum,c)=>sum+(Number(c.amount)||0),0);
      const selling=items.reduce((sum,it)=>sum+(Number(it.sell)||0)*(Number(it.qty)||0),0);
      const cost=material+extras;
      const profit=selling-cost;
      const marginPct=selling>0?(profit/selling)*100:0;
      docs.push({rfq:r,version,status,rawStatus:v.status||'Saved',updated:v.updated||v.created||r.date||'',cost,selling,profit,marginPct,quote,versionData:v,pricingNo:'PRC-'+String(r.rfqNo||r.id).replace(/[^A-Za-z0-9-]/g,'')+'-V'+version});
    });
  });
  return docs.sort((a,b)=>String(b.updated).localeCompare(String(a.updated))||b.version-a.version);
}
function pricingDocMoney(n){return documentMoney('pricing','lineAmount',n);}
function openPricingSourceRFQs(){
  const nav=document.querySelector('[data-nav-page="rfq"]');
  showPage('rfq',nav);
  setTimeout(()=>{
    const btn=document.getElementById('rfq-f-new')||document.getElementById('rfq-f-all');
    if(btn) filterRFQ(btn.id==='rfq-f-new'?'New':'all',btn);
  },0);
}
function pricingDateRangeForPreset(preset){return rfqDateRangeForPreset(preset);}
function pricingMatchesDateFilter(d){
  if(!pricingDateFilter||pricingDateFilter.preset==='all')return true;
  const date=String(d?.updated||'').substring(0,10);
  if(!date)return false;
  const from=pricingDateFilter.from||'',to=pricingDateFilter.to||'';
  if(from&&date<from)return false;
  if(to&&date>to)return false;
  return true;
}
function togglePricingDateMenu(event){
  event?.stopPropagation();
  const menu=document.getElementById('pricing-date-menu');if(!menu)return;
  const willOpen=!menu.classList.contains('open');
  closePricingDateMenu();
  if(willOpen)menu.classList.add('open');
  document.getElementById('pricing-date-filter-btn')?.setAttribute('aria-expanded',willOpen?'true':'false');
}
function closePricingDateMenu(){
  document.getElementById('pricing-date-menu')?.classList.remove('open');
  document.getElementById('pricing-date-filter-btn')?.setAttribute('aria-expanded','false');
}
function setPricingDatePreset(preset){
  pricingDateFilter=preset==='all'?{preset:'all',from:'',to:''}:{preset,...pricingDateRangeForPreset(preset)};
  document.querySelectorAll('#page-costing .pricing-overview-row').forEach(row=>{
    const active=(row.dataset.pricingFilter||'')==='all';
    row.classList.toggle('active',active);
    row.setAttribute('aria-pressed',active?'true':'false');
  });
  updatePricingDateFilterUI();closePricingDateMenu();renderPricingDocuments();updatePricingOverviewTint();
}
function applyPricingCustomDate(){
  const from=document.getElementById('pricing-date-from')?.value||'';
  const to=document.getElementById('pricing-date-to')?.value||'';
  if(!from&&!to){setPricingDatePreset('all');return;}
  if(from&&to&&from>to){showToast('From date cannot be after To date','warning');return;}
  pricingDateFilter={preset:'custom',from,to};
  updatePricingDateFilterUI();closePricingDateMenu();renderPricingDocuments();
}
function clearPricingDateFilter(){
  const from=document.getElementById('pricing-date-from'),to=document.getElementById('pricing-date-to');
  if(from)from.value='';if(to)to.value='';setPricingDatePreset('all');
}
function updatePricingDateFilterUI(){
  const label=document.getElementById('pricing-date-filter-label');
  const btn=document.getElementById('pricing-date-filter-btn');
  const labels={all:'All Dates',today:'Today',week:'This Week',month:'This Month',lastmonth:'Last Month','30days':'Last 30 Days',last3months:'Last 3 Months'};
  let text=labels[pricingDateFilter.preset]||'Custom Range';
  if(pricingDateFilter.preset==='custom'){
    if(pricingDateFilter.from&&pricingDateFilter.to)text=`${fmtDate(pricingDateFilter.from)} – ${fmtDate(pricingDateFilter.to)}`;
    else if(pricingDateFilter.from)text=`From ${fmtDate(pricingDateFilter.from)}`;
    else if(pricingDateFilter.to)text=`To ${fmtDate(pricingDateFilter.to)}`;
  }
  if(label)label.textContent=text;
  btn?.classList.toggle('active',pricingDateFilter.preset!=='all');
  document.querySelectorAll('#page-costing .pricing-date-preset').forEach(el=>el.classList.toggle('active',el.dataset.preset===pricingDateFilter.preset));
}
if(!window.__bizcorePricingDateMenuBound){
  window.__bizcorePricingDateMenuBound=true;
  document.addEventListener('click',e=>{if(!e.target.closest('.pricing-date-filter-wrap'))closePricingDateMenu();});
}
function pricingDocMargin(n){return Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})+'%';}

function applyOverviewTint(selector,key,styles){
  document.querySelectorAll(selector).forEach(el=>{
    const elKey=el.dataset.overviewKey||'';
    const active=elKey===key;
    el.classList.toggle('active',active);
    el.setAttribute('aria-pressed',active?'true':'false');
    if(active){
      const s=styles[elKey]||styles.all;
      el.style.setProperty('background-color',s.bg,'important');
      el.style.setProperty('box-shadow',`inset 3px 0 0 ${s.accent}`,'important');
    }else{
      el.style.removeProperty('background-color');
      el.style.removeProperty('box-shadow');
    }
  });
}
function updatePricingOverviewTint(){
  const styles={
    all:{bg:'#eef6ff',accent:'#2e75b6'},
    Saved:{bg:'#fff8e5',accent:'#d7a323'},
    Converted:{bg:'#eef9f2',accent:'#43a66b'}
  };
  applyOverviewTint('#page-costing .pricing-overview-row',pricingDocumentFilter||'all',styles);
}
function updateQuotationOverviewTint(){
  const status=document.getElementById('filter-status')?.value||'';
  const key=status||'all';
  const styles={
    all:{bg:'#eef6ff',accent:'#2e75b6'},
    Draft:{bg:'#fff8e5',accent:'#d7a323'},
    Sent:{bg:'#eef6ff',accent:'#3b82c4'},
    Won:{bg:'#eef9f2',accent:'#43a66b'},
    Lost:{bg:'#fff0f0',accent:'#d85b5b'},
    Expired:{bg:'#fff4e8',accent:'#d9822b'},
    Revised:{bg:'#f5f0ff',accent:'#8b6fc7'},
    Cancelled:{bg:'#f2f4f6',accent:'#7b8794'}
  };
  applyOverviewTint('#page-quotations [data-overview-key]',key,styles);
}
function updateSOOverviewTint(){
  const key=soKpiFilter==='none'?'all':soKpiFilter;
  const styles={
    all:{bg:'#eef6ff',accent:'#2e75b6'},
    'status-confirmed':{bg:'#eef6ff',accent:'#3b82c4'},
    'status-ofd':{bg:'#eef6ff',accent:'#3b82f6'},
    'status-partdel':{bg:'#fff8e5',accent:'#d7a323'},
    'status-delivered':{bg:'#eef9f2',accent:'#43a66b'},
    'status-invoiced':{bg:'#fff4e8',accent:'#d9822b'},
    'status-partpaid':{bg:'#fff8e5',accent:'#d7a323'},
    'status-paid':{bg:'#eef9f2',accent:'#43a66b'},
    open:{bg:'#fff8e5',accent:'#d7a323'},
    'pending-invoice':{bg:'#eef6ff',accent:'#3b82c4'}
  };
  applyOverviewTint('#page-salesorders .so-kpi',key,styles);
}

function filterPricingDocuments(filter,btn){
  pricingDocumentFilter=filter||'all';
  pricingDocPage=1;
  document.querySelectorAll('.pricing-register-filters .dash-period-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  document.querySelectorAll('#page-costing .pricing-overview-row').forEach(row=>{
    const key=row.dataset.pricingFilter||'';
    const active=key===pricingDocumentFilter;
    row.classList.toggle('active',active);
    row.setAttribute('aria-pressed',active?'true':'false');
  });
  renderPricingDocuments();
  updatePricingOverviewTint();
}
function clearAllPricingFilters(){
  pricingDocumentFilter='all';
  pricingDateFilter={preset:'all',from:'',to:''};
  const search=document.getElementById('pricing-doc-search');if(search)search.value='';
  const from=document.getElementById('pricing-date-from');if(from)from.value='';
  const to=document.getElementById('pricing-date-to');if(to)to.value='';
  document.querySelectorAll('.pricing-register-filters .dash-period-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('pricing-doc-f-all')?.classList.add('active');
  updatePricingDateFilterUI();closePricingDateMenu();renderPricingDocuments();
}
function openPricingDocument(rfqId,version){
  const r=rfqs.find(x=>x.id===rfqId);if(!r)return;
  const v=ensurePricingVersions(r).find(x=>Number(x.version)===Number(version));if(!v)return;
  syncRFQFromPricingVersion(r,v);
  openPricingSheet(rfqId);
}
function openPricingLinkedQuotation(id){
  if(!id)return;
  const q=quotations.find(x=>x.id===id || x.qno===id);
  if(!q){
    showConfirm({
      icon:'⚠️',
      title:'Quotation not available',
      message:'The Pricing document contains a quotation link, but that quotation is not available in the current quotation data.',
      details:{'Linked value':id},
      confirmText:'Refresh registers',
      cancelText:'Close',
      confirmClass:'btn-primary',
      onConfirm:()=>{
        if(typeof renderTable==='function')renderTable();
        if(typeof renderPricingDocuments==='function')renderPricingDocuments();
      }
    });
    return;
  }
  viewQuotation(q.id);
}
function renderPricingDocuments(){
  const tbody=document.getElementById('pricing-doc-tbody');if(!tbody)return;
  const all=getPricingDocuments();
  const saved=all.filter(d=>d.status==='Saved'), converted=all.filter(d=>d.status==='Converted');
  const set=(id,val)=>{const e=document.getElementById(id);if(e)e.textContent=val};
  set('pricing-doc-k-total',all.length);set('pricing-doc-k-saved',saved.length);set('pricing-doc-k-converted',converted.length);updatePricingOverviewTint();
  document.querySelectorAll('#page-costing .pricing-overview-row').forEach(row=>{
    const key=row.dataset.pricingFilter||'';
    const active=key===pricingDocumentFilter;
    row.classList.toggle('active',active);
    row.setAttribute('aria-pressed',active?'true':'false');
  });
  set('pricing-doc-c-all',all.length?'('+all.length+')':'');set('pricing-doc-c-saved',saved.length?'('+saved.length+')':'');set('pricing-doc-c-converted',converted.length?'('+converted.length+')':'');
  const search=(document.getElementById('pricing-doc-search')?.value||'').trim().toLowerCase();
  const rows=all.filter(d=>(pricingDocumentFilter==='all'||d.status===pricingDocumentFilter)&&pricingMatchesDateFilter(d)&&(!search||[d.pricingNo,d.rfq.rfqNo,d.rfq.company,d.rfq.ref,d.quote?.qno].some(x=>String(x||'').toLowerCase().includes(search))));
  const sortedRows=sortRegisterRows(rows,'pricing',{no:d=>d.pricingNo,customer:d=>d.rfq.company,version:d=>d.version,updated:d=>d.updated,cost:d=>d.cost,selling:d=>d.selling,profit:d=>d.profit,margin:d=>d.marginPct,status:d=>d.status,quotation:d=>d.quote?.qno||''});
  const pricingDocPages = Math.ceil(sortedRows.length / PRICING_DOC_PER_PAGE) || 1;
  if (pricingDocPage > pricingDocPages) pricingDocPage = 1;
  const pageRows = sortedRows.slice((pricingDocPage-1)*PRICING_DOC_PER_PAGE, pricingDocPage*PRICING_DOC_PER_PAGE);
  tbody.innerHTML=pageRows.length?pageRows.map(d=>`<tr class="pricing-doc-row" onclick="openPricingDocument('${d.rfq.id}',${d.version})" title="Open ${esc(d.pricingNo)}" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openPricingDocument('${d.rfq.id}',${d.version})}">
    <td class="pricing-doc-no">${esc(d.pricingNo)}</td>
    <td class="pricing-doc-customer" title="${esc(d.rfq.company||'—')}">${esc(d.rfq.company||'—')}</td><td class="pricing-doc-muted center">V${d.version}</td><td class="pricing-doc-muted">${fmtDate(String(d.updated).slice(0,10))}</td>
    <td class="right">${pricingDocMoney(d.cost)}</td><td class="right">${pricingDocMoney(d.selling)}</td><td class="right pricing-doc-profit ${d.profit<0?'is-negative':''}">${pricingDocMoney(d.profit)}</td><td class="right pricing-doc-margin ${d.marginPct<0?'is-negative':''}">${pricingDocMargin(d.marginPct)}</td>
    <td class="center"><span class="status ${d.status==='Converted'?'status-won':'status-draft'}">${d.status}</span></td>
    <td>${d.quote?`<button class="pricing-doc-link" onclick="event.stopPropagation();openPricingLinkedQuotation('${d.quote.id}')">${esc(d.quote.qno)}</button>`:'—'}</td>
  </tr>`).join(''):`<tr><td colspan="10"><div class="empty-state"><i class="ti ti-calculator"></i><h3>No pricing documents found</h3><p>Pricing documents appear here after a pricing sheet is saved.</p></div></td></tr>`;
  document.querySelectorAll('.rows-per-page-select').forEach(el=>{ if(el.value!=String(PRICING_DOC_PER_PAGE)) el.value = String(PRICING_DOC_PER_PAGE); });
  const pdp = document.getElementById('pricing-doc-pagination');
  if (pdp) pdp.innerHTML = buildPaginationHTML(pricingDocPage, pricingDocPages, 'goPricingDocPage');
  const pb=document.getElementById('pricing-badge');if(pb){pb.textContent=saved.length;pb.style.display=saved.length?'inline-flex':'none';pb.title=saved.length+' saved pricing document'+(saved.length===1?'':'s');}
}

/* ── v121 Pricing Register Excel Export ────────────────────────────────
   Uses the same pilot standard as Quotation: filtered summary plus an
   optional, relational line-items worksheet. */
function getPricingRegisterExportRows(){
  const search=(document.getElementById('pricing-doc-search')?.value||'').trim().toLowerCase();
  const rows=getPricingDocuments().filter(d=>(pricingDocumentFilter==='all'||d.status===pricingDocumentFilter)&&pricingMatchesDateFilter(d)&&(!search||[d.pricingNo,d.rfq.rfqNo,d.rfq.company,d.rfq.ref,d.quote?.qno].some(x=>String(x||'').toLowerCase().includes(search))));
  return sortRegisterRows(rows,'pricing',{no:d=>d.pricingNo,customer:d=>d.rfq.company,version:d=>d.version,updated:d=>d.updated,cost:d=>d.cost,selling:d=>d.selling,profit:d=>d.profit,margin:d=>d.marginPct,status:d=>d.status,quotation:d=>d.quote?.qno||''});
}
function pricingExportFilterSummary(){
  const parts=[];
  if(pricingDocumentFilter && pricingDocumentFilter!=='all') parts.push(`Status: ${pricingDocumentFilter}`);
  if(pricingDateFilter?.preset && pricingDateFilter.preset!=='all'){
    const from=pricingDateFilter.from||'',to=pricingDateFilter.to||'';
    parts.push(`Updated: ${from||'Beginning'} to ${to||'Latest'}`);
  }
  const search=(document.getElementById('pricing-doc-search')?.value||'').trim();
  if(search) parts.push(`Search: ${search}`);
  return parts.length?parts.join(' | '):'All pricing documents';
}
function openPricingExcelExportDialog(){
  const rows=getPricingRegisterExportRows();
  if(!rows.length){showToast('No pricing documents match the current filters. Nothing to export.','warning');return;}
  document.getElementById('pricing-export-overlay')?.remove();
  const overlay=document.createElement('div');
  overlay.id='pricing-export-overlay';
  overlay.className='confirm-overlay quotation-export-overlay';
  overlay.innerHTML=`<div class="confirm-box quotation-export-box" role="dialog" aria-modal="true" aria-labelledby="pricing-export-title">
    <div class="confirm-icon"><i class="ti ti-file-spreadsheet"></i></div>
    <div class="confirm-title" id="pricing-export-title">Export Pricing Register</div>
    <div class="confirm-msg">Choose the level of detail to include in the Excel workbook.</div>
    <div class="quotation-export-options">
      <label class="quotation-export-option"><input type="radio" name="pricing-export-scope" value="summary"><span><strong>Pricing Summary Only</strong><small>One row per pricing document in the Pricing Register sheet.</small></span></label>
      <label class="quotation-export-option selected"><input type="radio" name="pricing-export-scope" value="lines" checked><span><strong>Summary + Line Items</strong><small>Adds a separate Pricing Line Items worksheet linked by pricing number.</small></span></label>
    </div>
    <div class="quotation-export-count"><i class="ti ti-filter"></i><strong>${rows.length}</strong> pricing document${rows.length===1?'':'s'} will be exported based on the current filters.</div>
    <div class="confirm-btns"><button class="btn btn-secondary" id="pricing-export-cancel">Cancel</button><button class="btn btn-primary" id="pricing-export-confirm"><i class="ti ti-file-spreadsheet"></i> Export Excel</button></div>
  </div>`;
  document.body.appendChild(overlay);
  const options=[...overlay.querySelectorAll('.quotation-export-option')];
  options.forEach(label=>label.addEventListener('click',()=>{options.forEach(x=>x.classList.remove('selected'));label.classList.add('selected');}));
  const close=()=>overlay.remove();
  overlay.querySelector('#pricing-export-cancel').onclick=close;
  overlay.querySelector('#pricing-export-confirm').onclick=()=>{const includeLines=overlay.querySelector('input[name="pricing-export-scope"]:checked')?.value==='lines';close();exportPricingRegisterExcel(includeLines,rows);};
  overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
  const esc=e=>{if(e.key==='Escape'&&document.getElementById('pricing-export-overlay')){close();document.removeEventListener('keydown',esc);}};
  document.addEventListener('keydown',esc);
  setTimeout(()=>overlay.querySelector('#pricing-export-confirm')?.focus(),50);
}
function buildPricingLineItemRows(rows){
  const output=[];
  rows.forEach(d=>{
    const v=d.versionData||ensurePricingVersions(d.rfq).find(x=>Number(x.version)===Number(d.version))||{};
    (v.pricingItems||[]).slice().sort((a,b)=>(Number(a.sortOrder)||0)-(Number(b.sortOrder)||0)).forEach((it,index)=>{
      const qty=Number(it.qty)||0,buy=Number(it.buy)||0,sell=Number(it.sell)||0;
      const cost=qty*buy,selling=qty*sell,profit=selling-cost,margin=selling>0?(profit/selling)*100:0;
      output.push([d.pricingNo,d.rfq.rfqNo||'',d.rfq.company||'',d.version,index+1,it.sortOrder??index+1,it.code||'',it.desc||'',qty,it.uom||'',it.supplierName||it.supplier||'',it.supRef||'',buy,cost,Number(it.markup)||0,sell,selling,profit,margin]);
    });
  });
  return output;
}
function exportPricingRegisterExcel(includeLines=false,prefetchedRows=null){
  if(typeof XLSX==='undefined'){showToast('Excel library is not available. Check your internet connection and try again.','error');return;}
  const rows=prefetchedRows||getPricingRegisterExportRows();
  if(!rows.length){showToast('No pricing documents match the current filters. Nothing to export.','warning');return;}
  try{
    const now=new Date(),exportedAt=now.toLocaleString(),companyName=settings?.coname||'BizCore';
    const headers=['Pricing No.','RFQ No.','Updated','Customer','Customer Reference','Version','Status','Primary Supplier','Supplier Quote Ref.','Material Cost','Additional Cost','Total Cost','Selling Value','Profit','Margin %','Quotation No.'];
    const data=rows.map(d=>{
      const v=d.versionData||{};
      const material=(v.pricingItems||[]).reduce((sum,it)=>sum+(Number(it.buy)||0)*(Number(it.qty)||0),0);
      const extras=(v.internalCosts||[]).reduce((sum,c)=>sum+(Number(c.amount)||0),0);
      return [d.pricingNo,d.rfq.rfqNo||'',String(d.updated||'').slice(0,10),d.rfq.company||'',d.rfq.ref||'',d.version,d.status,v.supplierName||d.rfq.supplierName||'',v.supRef||d.rfq.supRef||'',material,extras,d.cost,d.selling,d.profit,d.marginPct,d.quote?.qno||''];
    });
    const ws=XLSX.utils.aoa_to_sheet([[`${companyName} — Pricing Register`],[`Exported: ${exportedAt}`],[`Filters: ${pricingExportFilterSummary()}`],[`Records: ${rows.length}`],[],headers,...data]);
    ws['!cols']=[{wch:24},{wch:20},{wch:13},{wch:30},{wch:24},{wch:9},{wch:13},{wch:28},{wch:22},{wch:15},{wch:15},{wch:15},{wch:15},{wch:15},{wch:12},{wch:20}];
    ws['!autofilter']={ref:`A6:P${rows.length+6}`}; ws['!freeze']={xSplit:0,ySplit:6,topLeftCell:'A7',activePane:'bottomLeft',state:'frozen'};
    for(let r=7;r<=rows.length+6;r++){['J','K','L','M','N'].forEach(c=>{if(ws[`${c}${r}`])ws[`${c}${r}`].z='#,##0.00';});if(ws[`O${r}`])ws[`O${r}`].z='0.00';}
    const wb=XLSX.utils.book_new(); wb.Props={Title:'BizCore Pricing Register',Subject:includeLines?'Pricing register and line item export':'Pricing register export',Author:companyName,CreatedDate:now};
    XLSX.utils.book_append_sheet(wb,ws,'Pricing Register');
    let lineCount=0;
    if(includeLines){
      const lineHeaders=['Pricing No.','RFQ No.','Customer','Version','Item Line','Sort Order','Item Code','Description','Qty','UOM','Supplier','Supplier Quote Ref.','Buy Unit Price','Line Cost','Markup %','Sell Unit Price','Line Selling','Line Profit','Margin %'];
      const lineRows=buildPricingLineItemRows(rows); lineCount=lineRows.length;
      const lws=XLSX.utils.aoa_to_sheet([[`${companyName} — Pricing Line Items`],[`Exported: ${exportedAt}`],[`Filters: ${pricingExportFilterSummary()}`],[`Pricing documents: ${rows.length} | Lines: ${lineRows.length}`],[],lineHeaders,...lineRows]);
      lws['!cols']=[{wch:24},{wch:20},{wch:30},{wch:9},{wch:10},{wch:10},{wch:16},{wch:42},{wch:11},{wch:10},{wch:28},{wch:22},{wch:15},{wch:15},{wch:12},{wch:15},{wch:15},{wch:15},{wch:12}];
      lws['!autofilter']={ref:`A6:S${lineRows.length+6}`}; lws['!freeze']={xSplit:0,ySplit:6,topLeftCell:'A7',activePane:'bottomLeft',state:'frozen'};
      for(let r=7;r<=lineRows.length+6;r++){['M','N','P','Q','R'].forEach(c=>{if(lws[`${c}${r}`])lws[`${c}${r}`].z='#,##0.00';});['O','S'].forEach(c=>{if(lws[`${c}${r}`])lws[`${c}${r}`].z='0.00';});}
      XLSX.utils.book_append_sheet(wb,lws,'Pricing Line Items');
    }
    const dateStamp=now.toISOString().slice(0,10); XLSX.writeFile(wb,`BizCore_Pricing_Register_${dateStamp}.xlsx`,{compression:true});
    showToast(`Pricing Excel exported: ${rows.length} document${rows.length===1?'':'s'}${includeLines?` and ${lineCount} line${lineCount===1?'':'s'}`:''}.`,'success');
  }catch(err){console.error('Pricing Excel export failed',err);showToast('Could not create the Pricing Excel export. Please try again.','error');}
}

function goPricingDocPage(p){ pricingDocPage=p; renderPricingDocuments(); }

function showPage(page, el) {
  const masterAliases=['customers','suppliers','products','employees','units'];
  const requestedMasterTab=masterAliases.includes(page)?page:null;
  const targetPage=requestedMasterTab?'masters':page;
  const pageEl=document.getElementById('page-'+targetPage);
  if(!pageEl){console.warn('Page not found:',targetPage);return;}
  // Always begin a newly selected module at the top of the workspace.
  // The content area is the scroll container, so retaining its previous
  // scroll position can make the next page appear underneath the top header.
  const contentScroller=document.querySelector('.content');
  if(contentScroller) contentScroller.scrollTop=0;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  pageEl.classList.add('active');
  if(!el) el=document.querySelector(`[data-nav-page="${page}"]`)||document.querySelector(`[data-nav-page="${targetPage}"]`);
  setActiveMenuItem(el);
  const titles={masters:'Master Data',dashboard:'Dashboard',rfq:'RFQs',costing:'Pricing',quotations:'Quotations',customers:'Customers',suppliers:'Suppliers',products:'Products',analytics:'Reports',setup:'Administration',salesorders:'Sales Orders',deliverynotes:'Delivery Notes',customerinvoices:'Invoices',supplierrfqs:'Supplier RFQs',purchaseorders:'Purchase Orders',purchaseinvoices:'Purchase Invoices',stock:'Stock',warehouses:'Warehouses',categories:'Categories',units:'Units',employees:'Employees'};
  document.getElementById('page-title').textContent=titles[page]||page;
  if(targetPage==='masters'){switchMastersTab(requestedMasterTab||'customers');}
  if(page==='setup'){applySettings();loadAccessSetup();switchSetupTab('branding');renderSetupTermsList('delivery');renderSetupTermsList('payment');}
  if(page==='rfq'){renderRFQPage();setTimeout(()=>{const btn=document.getElementById('rfq-f-all');filterRFQ('all',btn);},0);}
  if(page==='costing'){pricingDocumentFilter='all';renderPricingDocuments();}
  if(page==='quotations'){currentPage=1;renderTable();}
  if(page==='analytics')renderAnalytics();
  if(page==='salesorders')renderSOPage();
  if(page==='deliverynotes')renderDNPage();
  closeMobileSidebar();
}


function switchMastersTab(tab){
  const valid=['customers','suppliers','products','employees','units'];
  if(!valid.includes(tab)) tab='customers';
  document.querySelectorAll('.masters-tab-content').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.masters-tab').forEach(x=>{x.classList.remove('active');x.setAttribute('aria-selected','false');x.tabIndex=-1;});
  const panel=document.getElementById('masters-tab-'+tab);
  const button=document.getElementById('mtab-'+tab);
  if(panel) panel.classList.add('active');
  if(button){button.classList.add('active');button.setAttribute('aria-selected','true');button.tabIndex=0;}
  const labels={customers:'Customers',suppliers:'Suppliers',products:'Products',employees:'Employees',units:'Units of Measure'};
  const title=document.getElementById('page-title'); if(title) title.textContent=labels[tab]||'Masters';
  if(tab==='customers'){customerPage=1;renderCustomers();}
  if(tab==='suppliers'){supplierPage=1;renderSuppliers();}
  if(tab==='products'){prodPage=1;renderProducts();populateCategoryFilter();}
  if(tab==='employees'){employeePage=1;renderEmployees();}
  if(tab==='units') renderUomMaster();
}
function openMasters(tab){
  showPage('masters',document.querySelector('[data-nav-page="masters"]'));
  switchMastersTab(tab);
}

/* ── MOBILE SIDEBAR DRAWER ── */
function toggleMobileSidebar() {
  document.querySelector('.sidebar').classList.toggle('mobile-open');
  document.getElementById('sidebar-overlay').classList.toggle('show');
}
function closeMobileSidebar() {
  document.querySelector('.sidebar').classList.remove('mobile-open');
  document.getElementById('sidebar-overlay').classList.remove('show');
}

/* ── CUSTOMER AUTOCOMPLETE IN QUOTE MODAL ── */
function openCustDropdown() {
  const dd=document.getElementById('cust-dd');
  renderCustDropdown(document.getElementById('f-cust-search').value);
  dd.classList.add('open');
}
function closeCustDropdown() { const dd=document.getElementById('cust-dd'); if(dd) dd.classList.remove('open'); quoteCustomerHighlight=-1; }
function filterCustDropdown() { renderCustDropdown(document.getElementById('f-cust-search').value); }

function renderCustDropdown(q) {
  const dd=document.getElementById('cust-dd');
  const term=q.toLowerCase();
  const matches=customers.filter(c=>!term||c.company.toLowerCase().includes(term)||(c.contact||'').toLowerCase().includes(term));
  dd.innerHTML=matches.map(c=>`
    <div class="cust-option" data-customer-id="${c.id}" onmousedown="selectCustomer('${c.id}')">
      <div class="co-name">${c.company}</div>
      <div class="co-sub">${[c.contact,c.city].filter(Boolean).join(' · ')}</div>
    </div>`).join('');
  if(!matches.length) dd.innerHTML=`<div class="cust-option" style="color:var(--gray);font-style:italic">No customers found. <a href="#" onmousedown="showPage('customers',null);closeModal('quote-modal');return false" style="color:var(--blue)">Add in Customers</a></div>`;
  dd.classList.add('open');
  quoteCustomerHighlight=matches.length?0:-1;
  updateQuoteCustomerHighlight();
}

function updateQuoteCustomerHighlight(){
  const dd=document.getElementById('cust-dd'); if(!dd)return;
  const options=[...dd.querySelectorAll('.cust-option[data-customer-id]')];
  if(!options.length){quoteCustomerHighlight=-1;return;}
  quoteCustomerHighlight=Math.max(0,Math.min(quoteCustomerHighlight,options.length-1));
  options.forEach((el,i)=>el.classList.toggle('keyboard-active',i===quoteCustomerHighlight));
  options[quoteCustomerHighlight]?.scrollIntoView({block:'nearest'});
}
function handleQuoteCustomerKey(event){
  const dd=document.getElementById('cust-dd');
  const options=dd?[...dd.querySelectorAll('.cust-option[data-customer-id]')]:[];
  if(event.key==='Escape'){closeCustDropdown();return;}
  if(!options.length)return;
  if(event.key==='ArrowDown'){event.preventDefault();quoteCustomerHighlight=(quoteCustomerHighlight+1)%options.length;updateQuoteCustomerHighlight();return;}
  if(event.key==='ArrowUp'){event.preventDefault();quoteCustomerHighlight=(quoteCustomerHighlight-1+options.length)%options.length;updateQuoteCustomerHighlight();return;}
  if(event.key==='Enter'){event.preventDefault();const id=options[Math.max(0,quoteCustomerHighlight)]?.dataset.customerId;if(id)selectCustomer(id);}
}

function selectCustomer(id) {
  const c = customers.find(x=>x.id===id); if (!c) return;
  selectedCustId = id;
  document.getElementById('f-cust-search').value = c.company;
  document.getElementById('f-cust-search').classList.add('cust-locked');
  document.getElementById('f-company').value = c.company;
  document.getElementById('f-city').value = c.city||'';
  // Set default contact
  const contacts = c.contacts || (c.contact ? [{name:c.contact,title:'',phone:c.phone||''}] : []);
  const def = contacts.find(x=>x.isDefault) || contacts[0];
  document.getElementById('f-contact').value = def?.name || '';
  document.getElementById('f-contact').classList.remove('cust-locked');
  document.getElementById('f-contact-hint').style.display = 'none';
  closeCustDropdown();
  updateQuoteHeaderSummary();
  // If multiple contacts, auto-open the contact dropdown
  if (contacts.length > 1) {
    setTimeout(() => {
      document.getElementById('f-contact').focus();
    }, 100);
  }
}

function clearCustomerSelection() {
  selectedCustId = null;
  document.getElementById('f-cust-search').value = '';
  document.getElementById('f-cust-search').classList.remove('cust-locked');
  document.getElementById('f-company').value = '';
  document.getElementById('f-contact').value = '';
  document.getElementById('f-city').value = '';
  document.getElementById('f-contact-hint').style.display = 'none';
  updateQuoteHeaderSummary();
}

/* ── CONTACT DROPDOWN IN QUOTE MODAL ── */
function getSelectedCustomerContacts() {
  if (!selectedCustId) return [];
  const c = customers.find(x=>x.id===selectedCustId);
  if (!c) return [];
  return c.contacts || (c.contact ? [{name:c.contact, title:'', phone:c.phone||''}] : []);
}

function openContactDropdown() {
  if (!selectedCustId) return;
  renderContactDropdown(document.getElementById('f-contact').value);
}
function closeContactDropdown() {
  document.getElementById('contact-dd').classList.remove('open');
  // Check if typed value is a new contact (not in list)
  const val = document.getElementById('f-contact').value.trim();
  const contacts = getSelectedCustomerContacts();
  const isNew = val && !contacts.some(ct => ct.name.toLowerCase() === val.toLowerCase());
  document.getElementById('f-contact-hint').style.display = (isNew && val) ? 'block' : 'none';
}
function filterContactDropdown() {
  renderContactDropdown(document.getElementById('f-contact').value);
}

function renderContactDropdown(q) {
  const dd = document.getElementById('contact-dd');
  const contacts = getSelectedCustomerContacts();
  if (!contacts.length) { dd.classList.remove('open'); return; }
  const term = (q||'').toLowerCase();
  const matches = contacts.filter(ct => !term || ct.name.toLowerCase().includes(term));
  dd.innerHTML = matches.map(ct => `
    <div class="cust-option" onmousedown="selectContact('${ct.name.replace(/'/g,"\'")}')">
      <div class="co-name">${ct.name}${ct.isDefault?' <span style="font-size:10px;background:var(--blue);color:#fff;padding:1px 6px;border-radius:8px;margin-left:4px">Default</span>':''}</div>
      <div class="co-sub">${[ct.title, ct.phone].filter(Boolean).join(' · ')}</div>
    </div>`).join('');
  if (!matches.length) {
    dd.innerHTML = `<div class="cust-option" style="color:var(--gray)">No match — keep typing to use this name</div>`;
  }
  dd.classList.add('open');
}

function selectContact(name) {
  document.getElementById('f-contact').value = name;
  document.getElementById('contact-dd').classList.remove('open');
  document.getElementById('f-contact-hint').style.display = 'none';
}

async function saveNewContactFromQuote() {
  const name = document.getElementById('f-contact').value.trim();
  if (!name || !selectedCustId) return;
  const c = customers.find(x=>x.id===selectedCustId);
  if (!c) return;
  if (!c.contacts) c.contacts = c.contact ? [{name:c.contact,title:'',phone:c.phone||'',isDefault:true}] : [];
  // Add new contact if not duplicate
  if (!c.contacts.some(ct=>ct.name.toLowerCase()===name.toLowerCase())) {
    c.contacts.push({name, title:'', phone:'', isDefault:false});
    await saveCustomers();
    document.getElementById('f-contact-hint').style.display = 'none';
    showToast(name + ' saved to ' + c.company,'success');
  }
}


function setQuoteFormState(state='saved') {
  const top=document.getElementById('quote-form-state');
  const foot=document.getElementById('quote-footer-state');
  if(top){top.className='quote-save-state '+state;top.textContent=state==='unsaved'?'Unsaved changes':'Saved';}
  if(foot) foot.textContent=state==='unsaved'?'● Unsaved changes':'✓ Saved';
}
function quoteDateDisplayFromISO(iso){
  const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso||'');
}
function quoteDateISOFromDisplay(value){
  const v=String(value||'').trim();
  if(!v) return '';

  // Canonical stored format is already valid.
  let iso=v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(iso){
    const year=+iso[1], month=+iso[2], day=+iso[3];
    const dt=new Date(year,month-1,day);
    return (dt.getFullYear()===year&&dt.getMonth()===month-1&&dt.getDate()===day) ? v : '';
  }

  let m=v.match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})$/);
  if(!m) m=v.match(/^(\d{2})(\d{2})(\d{4})$/);
  if(!m) return '';
  const day=+m[1], month=+m[2], year=+m[3];
  const dt=new Date(year,month-1,day);
  if(dt.getFullYear()!==year||dt.getMonth()!==month-1||dt.getDate()!==day) return '';
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
function todayQuoteDateDisplay(){
  const d=new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}
function formatQuoteDateTyping(input){
  const digits=String(input.value||'').replace(/\D/g,'').slice(0,8);
  input.value=digits.length<=2?digits:digits.length<=4?`${digits.slice(0,2)}/${digits.slice(2)}`:`${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4)}`;
  input.classList.remove('field-error');
}
function normalizeQuoteDateInput(){
  const input=document.getElementById('f-date'); if(!input) return;
  const iso=quoteDateISOFromDisplay(input.value);
  if(iso){input.value=quoteDateDisplayFromISO(iso);input.classList.remove('field-error');}
  else if(input.value.trim()){input.classList.add('field-error');showToast('Enter quotation date as DD/MM/YYYY.','warning');}
  updateValidUntil();
}
function updateValidUntil(){
  const d=quoteDateISOFromDisplay(document.getElementById('f-date')?.value), days=parseInt(document.getElementById('f-validity')?.value)||0;
  const el=document.getElementById('quote-valid-until');
  const inline=document.getElementById('quote-validity-inline');
  if(!d){if(el)el.textContent='Valid until: —';if(inline)inline.textContent='Expiry calculated automatically';return;}
  const dt=new Date(d+'T00:00:00');dt.setDate(dt.getDate()+days);
  const formatted=dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  if(el)el.textContent='Valid until: '+formatted;
  if(inline)inline.textContent='Expires: '+formatted;
}
function updateQuoteHeaderSummary(){
  const q=document.getElementById('f-qno')?.value||'New quotation';
  const c=document.getElementById('f-company')?.value||document.getElementById('f-cust-search')?.value||'Select a customer';
  const city=document.getElementById('f-city')?.value||'';
  const no=document.getElementById('quote-strip-no'), cust=document.getElementById('quote-strip-customer'), info=document.getElementById('quote-customer-info'), sub=document.getElementById('quote-header-sub');
  if(no)no.textContent=q;if(cust)cust.textContent=c;if(sub)sub.textContent=q+' · '+c;
  if(info)info.innerHTML=c&&c!=='Select a customer'?'<i class="ti ti-map-pin"></i> '+(city||'Address not recorded'):'<i class="ti ti-info-circle"></i> Select a customer to display address and VAT information.';
}
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'&&document.getElementById('quote-modal')?.classList.contains('open')){e.preventDefault();saveQuotation('draft');}});


/* ── QUOTATION CREATION WORKFLOW ── */
let quotationWorkflowState={step:1,origin:'standard',type:'product'};

function quotationTypeLabel(type){return type==='contracting'?'Service Quotation':'Product Quotation';}
function quotationTypeIcon(type){return type==='contracting'?'ti-tool':'ti-package';}

function ensureQuotationWorkflowDialog(){
  let overlay=document.getElementById('quotation-workflow-modal');
  if(overlay) return overlay;
  overlay=document.createElement('div');
  overlay.id='quotation-workflow-modal';
  overlay.className='qwf-overlay';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-labelledby','qwf-title');
  overlay.innerHTML=`
    <div class="qwf-dialog" onclick="event.stopPropagation()">
      <div class="qwf-header">
        <div>
          <h2 id="qwf-title">Create New Quotation</h2>
          <p id="qwf-subtitle">Follow the guided setup before opening the entry form.</p>
        </div>
        <button type="button" class="qwf-close" aria-label="Close" onclick="closeQuotationWorkflowDialog()"><i class="ti ti-x"></i></button>
      </div>
      <div class="qwf-stepper" aria-label="Quotation creation steps">
        ${[1,2,3,4].map((n,i)=>`<div class="qwf-step" data-step="${n}"><span>${n}</span><small>${['Workflow','Method','Template','Confirm'][i]}</small></div>`).join('')}
      </div>
      <div class="qwf-body" id="qwf-body"></div>
      <div class="qwf-footer">
        <button type="button" class="btn btn-secondary" id="qwf-back" onclick="quotationWorkflowBack()"><i class="ti ti-arrow-left"></i> Back</button>
        <div class="qwf-footer-spacer"></div>
        <button type="button" class="btn btn-secondary" onclick="closeQuotationWorkflowDialog()">Cancel</button>
        <button type="button" class="btn btn-primary" id="qwf-next" onclick="quotationWorkflowNext()">Continue <i class="ti ti-arrow-right"></i></button>
      </div>
    </div>`;
  overlay.addEventListener('click',closeQuotationWorkflowDialog);
  document.body.appendChild(overlay);
  return overlay;
}

function renderQuotationWorkflowStep(){
  const overlay=ensureQuotationWorkflowDialog();
  const body=overlay.querySelector('#qwf-body');
  const state=quotationWorkflowState;
  overlay.querySelectorAll('.qwf-step').forEach(el=>{
    const n=Number(el.dataset.step);
    el.classList.toggle('active',n===state.step);
    el.classList.toggle('done',n<state.step);
  });
  const back=overlay.querySelector('#qwf-back');
  const next=overlay.querySelector('#qwf-next');
  back.style.visibility=state.step===1?'hidden':'visible';
  next.innerHTML=state.step===4
    ? (state.origin==='standard'?'<i class="ti ti-arrow-right"></i> Go to Pricing':'Create Quotation <i class="ti ti-check"></i>')
    : 'Continue <i class="ti ti-arrow-right"></i>';

  if(state.step===1){
    body.innerHTML=`
      <div class="qwf-step-intro"><span class="qwf-step-kicker">Step 1 of 4</span><h3>Understand the quotation workflow</h3><p>BizCore recommends creating quotations through RFQ and Pricing so costing, margin and document references remain traceable.</p></div>
      <div class="qwf-map" aria-label="Standard quotation workflow"><span>RFQ</span><i class="ti ti-arrow-right"></i><span>Pricing</span><i class="ti ti-arrow-right"></i><span>Quotation</span><i class="ti ti-arrow-right"></i><span>Sales Order</span></div>
      <div class="qwf-info"><i class="ti ti-bulb"></i><span>Direct quotation remains available for urgent, repeat or exceptional cases.</span></div>`;
  }else if(state.step===2){
    body.innerHTML=`
      <div class="qwf-step-intro"><span class="qwf-step-kicker">Step 2 of 4</span><h3>Choose the creation method</h3><p>Select whether this quotation should follow the standard workflow or bypass RFQ and Pricing.</p></div>
      <div class="qwf-options">
        <label class="qwf-option ${state.origin==='standard'?'selected':''}" data-qwf-option="standard">
          <input type="radio" name="quotation-origin-choice" value="standard" ${state.origin==='standard'?'checked':''}>
          <span><strong>Standard workflow</strong><small>Create from an approved Pricing document with complete costing, margin and traceability.</small></span><span class="qwf-badge">Recommended</span>
        </label>
        <label class="qwf-option ${state.origin==='direct'?'selected':''}" data-qwf-option="direct">
          <input type="radio" name="quotation-origin-choice" value="direct" ${state.origin==='direct'?'checked':''}>
          <span><strong>Direct quotation</strong><small>Bypass RFQ and Pricing. Use only for urgent, repeat or exceptional quotations.</small></span><span class="qwf-badge warning">Exception</span>
        </label>
      </div>`;
    body.querySelectorAll('input[name="quotation-origin-choice"]').forEach(r=>r.addEventListener('change',()=>{state.origin=r.value;body.querySelectorAll('.qwf-option').forEach(x=>x.classList.toggle('selected',x.dataset.qwfOption===r.value));}));
  }else if(state.step===3){
    const standard=state.origin==='standard';
    body.innerHTML=`
      <div class="qwf-step-intro"><span class="qwf-step-kicker">Step 3 of 4</span><h3>Choose the quotation template</h3><p>${standard?'Select the expected template. The final template will also be carried from the Pricing document.':'The selected template will be locked when the entry form opens.'}</p></div>
      <div class="qwf-template-grid">
        <button type="button" class="qwf-template ${state.type==='product'?'selected':''}" data-template="product">
          <span class="qwf-template-icon"><i class="ti ti-package"></i></span><strong>Product Quotation</strong><small>Products, quantity, UOM, unit price, brand, model and specifications.</small><span class="qwf-template-check"><i class="ti ti-check"></i></span>
        </button>
        <button type="button" class="qwf-template ${state.type==='contracting'?'selected':''}" data-template="contracting">
          <span class="qwf-template-icon service"><i class="ti ti-tool"></i></span><strong>Service Quotation</strong><small>Scope of work, service quantity, unit and rate. Estimated-cost analysis will be added later.</small><span class="qwf-template-check"><i class="ti ti-check"></i></span>
        </button>
      </div>`;
    body.querySelectorAll('.qwf-template').forEach(btn=>btn.addEventListener('click',()=>{state.type=btn.dataset.template;renderQuotationWorkflowStep();}));
  }else{
    const direct=state.origin==='direct';
    body.innerHTML=`
      <div class="qwf-step-intro"><span class="qwf-step-kicker">Step 4 of 4</span><h3>Review and confirm</h3><p>Confirm the document setup before continuing.</p></div>
      <div class="qwf-review">
        <div><span>Creation method</span><strong>${direct?'Direct quotation':'Standard workflow'}</strong></div>
        <div><span>Quotation template</span><strong><i class="ti ${quotationTypeIcon(state.type)}"></i> ${quotationTypeLabel(state.type)}</strong></div>
        <div><span>RFQ reference</span><strong>${direct?'Not linked':'Linked through Pricing'}</strong></div>
        <div><span>Pricing reference</span><strong>${direct?'Not linked':'Required'}</strong></div>
      </div>
      ${direct?'<div class="qwf-warning"><i class="ti ti-alert-triangle"></i><span>This document will be recorded with origin <strong>Direct</strong>. The quotation template cannot be changed after line entry begins.</span></div>':'<div class="qwf-info"><i class="ti ti-circle-check"></i><span>You will be taken to Pricing to choose an approved document and create the quotation.</span></div>'}`;
  }
}

function openQuotationWorkflowDialog(){
  quotationWorkflowState={step:1,origin:'standard',type:'product'};
  const overlay=ensureQuotationWorkflowDialog();
  renderQuotationWorkflowStep();
  overlay.classList.add('open');
  setTimeout(()=>overlay.querySelector('#qwf-next')?.focus(),30);
}
function closeQuotationWorkflowDialog(){document.getElementById('quotation-workflow-modal')?.classList.remove('open');}
function quotationWorkflowBack(){if(quotationWorkflowState.step>1){quotationWorkflowState.step--;renderQuotationWorkflowStep();}}
function quotationWorkflowNext(){
  const state=quotationWorkflowState;
  if(state.step<4){state.step++;renderQuotationWorkflowStep();return;}
  closeQuotationWorkflowDialog();
  if(state.origin==='standard'){
    window._pendingQuotationType=state.type;
    showToast('Choose an approved Pricing document and select Create Quotation.','info');
    if(typeof showPage==='function') showPage('pricing');
    return;
  }
  document._pendingRFQId=null;
  window._pendingQuotationOrigin='Direct';
  window._pendingQuotationType=state.type;
  openNewQuotation(state.type);
}

/* ── NEW / EDIT QUOTATION ── */
function setQuotationPricingContext(ctx=null){
  window._pendingQuotationPricingContext=ctx||null;
  const box=document.getElementById('quote-conversion-context');
  const summary=document.getElementById('quote-commercial-summary');
  if(!box||!summary)return;
  if(!ctx){box.style.display='none';summary.style.display='none';return;}
  box.style.display='flex';summary.style.display='block';
  document.getElementById('quote-conversion-title').textContent='Create from Pricing '+(ctx.pricingRef||'');
  document.getElementById('quote-conversion-subtitle').textContent=(ctx.rfqNo?('RFQ '+ctx.rfqNo+' · '):'')+'Review customer-facing terms before saving.';
  document.getElementById('qcs-ref').innerHTML='<span>Pricing reference</span><strong>'+escapeHtml(ctx.pricingRef||'—')+'</strong>';
  updateQuotationCommercialSummary();
}
function updateQuotationCommercialSummary(){
  const ctx=window._pendingQuotationPricingContext;
  const summary=document.getElementById('quote-commercial-summary'); if(!summary||!ctx)return;
  let value=0,changed=0;
  [...document.querySelectorAll('#items-tbody tr')].forEach((tr,i)=>{
    if(tr.dataset.lineType==='heading'||tr.dataset.lineType==='note')return;
    const qty=parseBizNumber(tr.querySelector('[data-quote-qty]')?.value), price=parseBizNumber(tr.querySelector('[data-quote-price]')?.value);
    value+=qty*price;
    const original=Number(tr.dataset.pricingSell||0); if(original&&Math.abs(price-original)>0.005)changed++;
  });
  const cost=Number(ctx.cost||0), profit=value-cost, margin=value?profit/value*100:0;
  const money=n=>documentMoney('quotation','summary',n);
  document.getElementById('qcs-cost').textContent=money(cost);document.getElementById('qcs-value').textContent=money(value);document.getElementById('qcs-profit').textContent=money(profit);document.getElementById('qcs-margin').textContent=margin.toFixed(1)+'%';
  const note=document.getElementById('qcs-change'); if(note){note.style.display=changed?'flex':'none';note.querySelector('span').textContent=changed+' selling price'+(changed===1?' has':'s have')+' changed from Pricing. Margin has been recalculated.';}
}

function openNewQuotation(templateType) {
  editingId=null;
  setQuotationPricingContext(null);
  const tax=activeTaxSettings(); currentQuoteVatRate=Number(tax.rate)||0;
  const selectedTemplate=(templateType||window._pendingQuotationType||'product')==='contracting'?'contracting':'product';
  document.getElementById('modal-title').textContent='New '+quotationTypeLabel(selectedTemplate);
  clearCustomerSelection();
  document.getElementById('f-ref').value='';
  document.getElementById('f-project').value='';
  document.getElementById('f-qno').value='Auto on Save';
  document.getElementById('f-qno').dataset.reservedQno='';
  document.getElementById('f-qno').dataset.isProvisional='0';
  document.getElementById('f-date').value=todayQuoteDateDisplay();
  document.getElementById('f-status').value='Draft';
  document.getElementById('f-validity').value=settings.validity||7;
  populateTermsSelect('delivery');
  populateTermsSelect('payment');
  document.getElementById('f-notes').value='';
  document.getElementById('f-internal-notes').value='';
  document.getElementById('f-discount').value='0';
  currentQuoteType=selectedTemplate;
  setQuoteType(selectedTemplate,{locked:true});
  document.getElementById('items-tbody').innerHTML='';
  addItemRow(selectedTemplate==='contracting'?{rowKind:'scope',qty:1,uom:'Job'}:{});
  calcTotals();
  if(document.getElementById('prod-search-inp')) document.getElementById('prod-search-inp').value='';
  updateValidUntil(); updateQuoteHeaderSummary(); setQuoteFormState('saved');
  openModalWithSize('quote-modal');
}

function editQuotation(id, skipVatCheck=false) {
  setQuotationPricingContext(null);
  const q=quotations.find(x=>x.id===id); if(!q) return;
  if((q.status||'Draft')!=='Draft'){showToast('This quotation is '+q.status+' and is locked. Create a revision to make changes.','error');return;}
  const activeTax=activeTaxSettings();
  const savedVat=getQuoteVatPercent(q);
  const defaultVat=Number(activeTax.rate)||0;
  if(!skipVatCheck && Math.abs(savedVat-defaultVat)>0.000001){
    showConfirm({
      icon:'%',
      title:'Default VAT rate has changed',
      message:`This draft quotation uses ${savedVat.toFixed(2).replace(/\.00$/,'')}% VAT, while the current default is ${defaultVat.toFixed(2).replace(/\.00$/,'')}%. Which rate should this draft use?`,
      details:{'Quotation':q.qno,'Saved VAT':savedVat.toFixed(2).replace(/\.00$/,'')+'%','Current default':defaultVat.toFixed(2).replace(/\.00$/,'')+'%'},
      confirmText:'Apply new VAT',
      cancelText:'Keep current VAT',
      confirmClass:'btn-primary',
      onConfirm:()=>{q.vatRate=defaultVat;q.taxCode=activeTax.code;q.taxName=activeTax.name;q.taxEffectiveFrom=activeTax.effectiveFrom;q.vatSource='Updated from Tax Master';q.updated=new Date().toISOString();saveQuotations().then(()=>editQuotation(id,true));},
      onCancel:()=>editQuotation(id,true)
    });
    return;
  }
  currentQuoteVatRate=getQuoteVatPercent(q);
  editingId=id;
  document.getElementById('modal-title').textContent='Edit — '+q.qno;

  // restore customer selection
  const c=customers.find(x=>x.company===q.company);
  if(c) {
    selectedCustId=c.id;
    document.getElementById('f-cust-search').value=c.company;
    document.getElementById('f-cust-search').classList.add('cust-locked');
  } else {
    // company exists in old data but not in master list — show it read-only
    selectedCustId='__legacy__';
    document.getElementById('f-cust-search').value=q.company+' (not in master list)';
    document.getElementById('f-cust-search').classList.add('cust-locked');
  }
  document.getElementById('f-company').value=q.company||'';
  document.getElementById('f-contact').value=q.contact||'';
  document.getElementById('f-contact').classList.remove('cust-locked');
  document.getElementById('f-contact-hint').style.display='none';
  document.getElementById('f-city').value=q.city||'';
  document.getElementById('f-ref').value=q.ref||'';
  document.getElementById('f-project').value=q.project||'';
  document.getElementById('f-qno').value=q.qno;
  document.getElementById('f-date').value=quoteDateDisplayFromISO(q.date||'');
  document.getElementById('f-status').value=q.status||'Draft';
  document.getElementById('f-validity').value=q.validity||7;
  // Populate dropdowns then restore saved value (add to list if custom)
  populateTermsSelect('delivery');
  populateTermsSelect('payment');
  // Restore saved terms - add as option if not in list
  ['delivery','payment'].forEach(type => {
    const savedVal = type==='delivery' ? (q.delivery||'') : (q.payment||'');
    const selId    = type==='delivery' ? 'f-delivery' : 'f-payment';
    const list     = type==='delivery' ? deliveryTerms : paymentTerms;
    if (savedVal && !list.some(t=>t.text===savedVal)) {
      // Add saved value as temporary option
      const sel = document.getElementById(selId);
      const opt = document.createElement('option');
      opt.value = savedVal; opt.textContent = savedVal;
      sel.insertBefore(opt, sel.firstChild);
    }
    if (savedVal) document.getElementById(selId).value = savedVal;
  });
  document.getElementById('f-notes').value=q.notes||'';
  document.getElementById('f-internal-notes').value=q.internalNotes||'';
  document.getElementById('f-discount').value=q.discount||0;
  // detect type from saved items or default to product
  const savedType = q.quoteType || (q.items||[])[0]?.type || 'product';
  currentQuoteType = savedType === 'contracting' ? 'contracting' : 'product';
  setQuoteType(currentQuoteType,{locked:true});
  document.getElementById('items-tbody').innerHTML='';
  (q.items||[]).forEach(it=>addItemRow(it));
  if(!q.items||!q.items.length) addItemRow();
  calcTotals();
  if(document.getElementById('prod-search-inp')) document.getElementById('prod-search-inp').value='';
  updateValidUntil(); updateQuoteHeaderSummary(); setQuoteFormState('saved');
  openModalWithSize('quote-modal');
}

function addItemRow(item={}) {
  if(item.lineType==='heading'||item.lineType==='note'){ addSpecialQuoteRow(item.lineType,item.text||item.desc||''); return; }
  const n = document.querySelectorAll('#items-tbody tr:not(.quote-special-row)').length+1;
  const tr = document.createElement('tr');
  tr.dataset.lineType='item';
  const isScopeRow = item.rowKind === 'scope' || item.type === 'contracting' || currentQuoteType === 'contracting';
  const isProduct = !isScopeRow;
  tr.dataset.rowKind = isScopeRow ? 'scope' : 'product';
  if (item.prodId) tr.dataset.prodId = item.prodId;
  if (item.image) tr.dataset.image = item.image;
  if(item.pricingSell!==undefined) tr.dataset.pricingSell=String(item.pricingSell);
  if(item.pricingBuy!==undefined) tr.dataset.pricingBuy=String(item.pricingBuy);
  const selectedUom=item.uom||(isProduct?'Pcs':'Job');
  const options=(isProduct?uomMaster.filter(u=>u.active):uomMaster.filter(u=>u.active && ['Job','Hours','Days','Months','Visit','Lump sum','EA'].includes(u.code)));
  if(!options.some(u=>u.code===selectedUom)) options.push(getUomRule(selectedUom));
  const uomOptions=options.map(u=>`<option value="${escapeHtml(u.code)}"${u.code===selectedUom?' selected':''}>${escapeHtml(u.code)}</option>`).join('');
  const qtyValue=item.qty!==undefined&&item.qty!==''?formatQtyForUom(item.qty,selectedUom):(isProduct?'':'1');
  const priceValue=item.up!==undefined&&item.up!==''?parseBizNumber(item.up).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'';
  if (isProduct) {
    tr.innerHTML = `
      <td style="text-align:center;color:var(--gray);font-size:11px;width:32px">${n}</td>
      <td><input placeholder="Code" value="${item.code||''}" style="font-size:12px"></td>
      <td><input placeholder="Brand" value="${item.brand||''}" style="font-size:11px;margin-bottom:3px"><input placeholder="Model" value="${item.model||''}" style="font-size:11px;margin-top:2px"></td>
      <td><input class="quote-line-product-search" placeholder="Search or select product" value="${item.desc||''}" autocomplete="off" onfocus="handleQuoteLineDescriptionFocus(this)" oninput="handleQuoteLineDescriptionInput(this)" onkeydown="handleQuoteLineDescriptionKeydown(event,this)" onblur="setTimeout(closeProdSearch,200)" style="width:100%;margin-bottom:3px;font-weight:500"><input placeholder="Specs (e.g. Color: White | Size: A4)" value="${item.specs||''}" style="width:100%;font-size:11px;color:var(--gray);margin-top:2px"></td>
      <td><input data-quote-qty type="text" inputmode="decimal" required value="${qtyValue}" onfocus="beginNumberEdit(this)" oninput="calcTotals()" onblur="enforceQuoteQty(this,true)" style="text-align:center"></td>
      <td><select class="quote-uom-readonly" data-master-uom="${escapeHtml(selectedUom)}" disabled aria-label="UOM derived from item master" title="Derived from Item / Service Master">${uomOptions}</select></td>
      <td><input data-quote-price type="text" inputmode="decimal" required value="${priceValue}" onfocus="beginNumberEdit(this)" oninput="calcTotals()" onblur="formatQuotePrice(this)" style="text-align:right"></td>
      <td class="total-cell">0.00</td><td><button class="del-btn" onclick="this.closest('tr').remove();calcTotals()"><i class="ti ti-trash"></i></button></td>`;
  } else {
    tr.innerHTML = `
      <td style="text-align:center;color:var(--gray);font-size:11px;width:32px">${n}</td>
      <td><textarea placeholder="Describe the scope of work, deliverables, civil / MEP work…" style="width:100%;height:64px;border:1px solid #ced4da;border-radius:4px;padding:6px 8px;font-size:12px;resize:vertical;outline:none;font-family:Inter,Segoe UI,Arial,sans-serif">${item.desc||''}</textarea></td>
      <td><input data-quote-qty type="text" inputmode="decimal" required value="${qtyValue}" onfocus="beginNumberEdit(this)" oninput="calcTotals()" onblur="enforceQuoteQty(this,true)" style="text-align:center"></td>
      <td><select class="quote-uom-readonly" data-master-uom="${escapeHtml(selectedUom)}" disabled aria-label="UOM derived from item master" title="Derived from Item / Service Master">${uomOptions}</select></td>
      <td><input data-quote-price type="text" inputmode="decimal" required value="${priceValue}" onfocus="beginNumberEdit(this)" oninput="calcTotals()" onblur="formatQuotePrice(this)" style="text-align:right"></td>
      <td class="total-cell">0.00</td><td><button class="del-btn" onclick="this.closest('tr').remove();calcTotals()"><i class="ti ti-trash"></i></button></td>`;
  }
  document.getElementById('items-tbody').appendChild(tr); calcTotals();
}

function addServiceRow() { addItemRow({rowKind:'scope', qty:1, uom:'Job'}); }
function renumberQuoteItemRows(){
  let n=0;
  document.querySelectorAll('#items-tbody tr').forEach(tr=>{
    if(tr.dataset.lineType==='heading'||tr.dataset.lineType==='note') return;
    n++;
    const cell=tr.cells&&tr.cells[0]; if(cell) cell.textContent=n;
  });
}
function isUntouchedQuoteItemRow(tr){
  if(!tr || tr.dataset.lineType==='heading' || tr.dataset.lineType==='note') return false;
  const controls=[...tr.querySelectorAll('input, textarea')];
  return controls.every(control=>{
    if(control.matches('[data-quote-qty]')){
      const value=(control.value||'').trim();
      // A service row may be initialized with quantity 1; it is still untouched
      // when every descriptive and price field remains empty.
      return value==='' || value==='1' || value==='1.00';
    }
    return (control.value||'').trim()==='';
  }) && !tr.dataset.prodId;
}
function replaceInitialBlankQuoteRowIfNeeded(){
  const tbody=document.getElementById('items-tbody');
  if(!tbody || tbody.children.length!==1) return;
  const onlyRow=tbody.firstElementChild;
  if(isUntouchedQuoteItemRow(onlyRow)) onlyRow.remove();
}
function addSpecialQuoteRow(type='note', text=''){
  const tbody=document.getElementById('items-tbody'); if(!tbody)return;
  // On a new quotation, Heading/Note should be allowed to become the first row.
  // Replace the untouched starter item row instead of appending below it.
  replaceInitialBlankQuoteRowIfNeeded();
  const tr=document.createElement('tr');
  tr.dataset.lineType=type;
  tr.className='quote-special-row '+(type==='heading'?'quote-heading-row':'quote-note-row');
  const label=type==='heading'?'Heading':'Note';
  const placeholder=type==='heading'?'e.g. Option 1 – Supply only':'e.g. Installation price is not included.';
  tr.innerHTML=`<td colspan="8"><div class="quote-special-wrap"><span class="quote-special-badge">${label}</span><input class="quote-special-text" value="${escapeHtml(text)}" placeholder="${placeholder}" onkeydown="handleSpecialQuoteRowKey(event,this)" oninput="markDirty('quote-modal')"></div></td><td><button class="del-btn" onclick="this.closest('tr').remove();renumberQuoteItemRows();calcTotals()"><i class="ti ti-trash"></i></button></td>`;
  tbody.appendChild(tr); renumberQuoteItemRows(); calcTotals();
  setTimeout(()=>tr.querySelector('input')?.focus(),0);
}
function handleSpecialQuoteRowKey(event,input){
  if(event.key==='Enter'){event.preventDefault(); addItemRow(); const last=document.querySelector('#items-tbody tr:last-child input, #items-tbody tr:last-child textarea'); last?.focus();}
  if(event.key==='Escape'){event.preventDefault(); input.blur();}
}


function openQuoteCalendar() {
  const picker = document.getElementById('f-date-calendar');
  if (!picker) return;
  syncQuoteCalendarFromText();
  if (typeof picker.showPicker === 'function') picker.showPicker();
  else picker.click();
}

function syncQuoteCalendarFromText() {
  const text = document.getElementById('f-date')?.value || '';
  const picker = document.getElementById('f-date-calendar');
  if (!picker) return;
  const parts = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (parts) picker.value = `${parts[3]}-${parts[2]}-${parts[1]}`;
}

function applyQuoteCalendarDate(iso) {
  if (!iso) return;
  const [y,m,d] = iso.split('-');
  const text = document.getElementById('f-date');
  if (text) text.value = `${d}/${m}/${y}`;
  updateValidUntil();
  markDirty('quote-modal');
}


async function clearAllItems() {
  const count=document.getElementById('items-tbody').children.length;
  if (!count) return;
  const confirmed=await new Promise(resolve=>showConfirm({icon:'🗑️',title:'Clear all line items?',message:'This will remove every line from the quotation. This action cannot be undone.',details:{'Lines to remove':count},confirmText:'Clear all lines',cancelText:'Cancel',confirmClass:'btn-danger',onConfirm:()=>resolve(true),onCancel:()=>resolve(false)}));
  if(!confirmed) return;
  document.getElementById('items-tbody').innerHTML='';
  calcTotals(); markDirty('quote-modal');
}

/* ── MODAL SIZE PRESETS ── */
const modalSizes = {};  // remember per modal

function updateFullscreenShellState() {
  const hasFullscreenModal = !!document.querySelector('.modal-overlay.open.modal-fs-overlay');
  document.body.classList.toggle('modal-fullscreen-active', hasFullscreenModal);
}

function setModalSize(modalId, size) {
  const overlay = document.getElementById(modalId);
  const modal = overlay.querySelector('.modal');
  if (!modal) return;

  // Remove all size classes
  modal.classList.remove('modal-compact','modal-normal','modal-fullscreen');
  overlay.classList.remove('modal-fs-overlay');

  // Apply new size
  modal.classList.add('modal-' + size);
  if (size === 'fullscreen') overlay.classList.add('modal-fs-overlay');

  // Remember choice for this modal
  modalSizes[modalId] = size;

  // Update active state on size buttons inside this modal header
  const btns = overlay.querySelectorAll('.modal-size-btn');
  btns.forEach(btn => {
    const isActive = btn.getAttribute('onclick') && btn.getAttribute('onclick').includes("'" + size + "'");
    btn.classList.toggle('active', isActive);
  });

  updateFullscreenShellState();
}

const modalNavHistory = [];
let lastClosedModal = null;
let lastClosedModalAt = 0;
const modalNavExcluded = new Set(['confirm-modal','validation-dialog','template-picker-modal']);

function modalFriendlyName(modalId) {
  const names={
    'rfq-view-modal':'RFQ','rfq-modal':'RFQ','pricing-modal':'Pricing','pricing-ro-modal':'Pricing',
    'quote-modal':'Quotation','view-modal':'Quotation','so-view-modal':'Sales Order','so-create-modal':'Sales Order',
    'cust-view-modal':'Customer','cust-modal':'Customer','sup-modal':'Supplier','prod-modal':'Product','prod-view-modal':'Product',
    'so-delivery-modal':'Sales Order','dn-print-modal':'Delivery Note','so-invoice-modal':'Sales Order','so-payment-modal':'Sales Order'
  };
  return names[modalId]||'Previous screen';
}

function ensureSmartBackButton(modalId) {
  if(modalNavExcluded.has(modalId)) return;
  const overlay=document.getElementById(modalId);
  const header=overlay?.querySelector('.modal-header');
  const title=header?.querySelector('h2');
  if(!header||!title) return;
  let wrap=header.querySelector('.modal-header-title-wrap');
  if(!wrap){
    wrap=document.createElement('div'); wrap.className='modal-header-title-wrap';
    title.parentNode.insertBefore(wrap,title); wrap.appendChild(title);
  }
  let btn=wrap.querySelector('.smart-back-btn');
  if(!btn){
    btn=document.createElement('button'); btn.type='button'; btn.className='smart-back-btn';
    btn.innerHTML='<i class="ti ti-arrow-left"></i><span>Back</span>';
    btn.onclick=()=>smartModalBack(modalId); wrap.insertBefore(btn,title);
  }
  const entry=[...modalNavHistory].reverse().find(x=>x.to===modalId);
  if(entry){btn.querySelector('span').textContent='Back to '+modalFriendlyName(entry.from);btn.classList.add('show');}
  else btn.classList.remove('show');
}

function smartModalBack(currentId) {
  let idx=-1;
  for(let i=modalNavHistory.length-1;i>=0;i--){if(modalNavHistory[i].to===currentId){idx=i;break;}}
  if(idx<0){closeModal(currentId);return;}
  const entry=modalNavHistory.splice(idx,1)[0];
  const current=document.getElementById(currentId);
  current?.classList.remove('open','modal-fs-overlay');
  const previous=document.getElementById(entry.from);
  if(previous){previous.classList.add('open');setModalSize(entry.from,modalSizes[entry.from]||'normal');ensureSmartBackButton(entry.from);}
  else updateFullscreenShellState();
}

function openModalWithSize(modalId) {
  const savedSize = modalSizes[modalId] || modalDefaultWorkspace[modalId] || 'normal';
  const now=Date.now();
  const currentlyOpen=[...document.querySelectorAll('.modal-overlay.open')].map(x=>x.id).filter(id=>id&&id!==modalId&&!modalNavExcluded.has(id));
  let from=currentlyOpen[currentlyOpen.length-1]||null;
  if(!from && lastClosedModal && now-lastClosedModalAt<1200 && lastClosedModal!==modalId && !modalNavExcluded.has(lastClosedModal)) from=lastClosedModal;
  if(from && !modalNavHistory.some(x=>x.from===from&&x.to===modalId)) modalNavHistory.push({from,to:modalId});
  document.getElementById(modalId).classList.add('open');
  setModalSize(modalId, savedSize);
  ensureSmartBackButton(modalId);
  lastClosedModal=null;
}

function calcTotals() {
  let sub=0;
  document.querySelectorAll('#items-tbody tr').forEach(tr=>{
    if(tr.dataset.lineType==='heading'||tr.dataset.lineType==='note') return;
    const qty=parseBizNumber(tr.querySelector('[data-quote-qty]')?.value);
    const up=parseBizNumber(tr.querySelector('[data-quote-price]')?.value);
    const tot=qty*up; sub+=tot;
    const tc=tr.querySelector('.total-cell');
    if(tc) tc.textContent=tot.toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2});
  });
  const disc=parseFloat(document.getElementById('f-discount').value)||0;
  const bvat=Math.max(0,sub-disc);
  const rate=Number.isFinite(Number(currentQuoteVatRate))?Number(currentQuoteVatRate):getQuoteVatPercent();
  const vat=Math.round(bvat*(rate/100)*100)/100;
  const net=bvat+vat;
  document.getElementById('t-subtotal').textContent=documentMoney('quotation','summary',sub);
  document.getElementById('t-discount').textContent='- '+documentMoney('quotation','summary',disc);
  document.getElementById('t-before-vat').textContent=documentMoney('quotation','summary',bvat);
  document.getElementById('t-vat').textContent=documentMoney('quotation','summary',vat);
  document.getElementById('t-net').textContent=documentMoney('quotation','grandTotal',net);
  updateQuotationCommercialSummary();
  document.getElementById('t-vat-label').textContent=`VAT (${Number(currentQuoteVatRate??getQuoteVatPercent()).toFixed(2).replace(/\.00$/,'')}%)`;
}

async function saveQuotation(mode='save') {
  if(mode==='draft') document.getElementById('f-status').value='Draft';
  if(mode==='sent') document.getElementById('f-status').value='Sent';
  const company=document.getElementById('f-company').value.trim();
  if(!selectedCustId){showToast('Please select a customer from the dropdown','error');return;}
  if(!company){showToast('Customer name is missing','error');return;}
  const rows=[...document.querySelectorAll('#items-tbody tr')];
  if(!rows.length){showToast('Add at least one quotation line','error');return;}
  for(let i=0;i<rows.length;i++){
    if(rows[i].dataset.lineType==='heading'||rows[i].dataset.lineType==='note'){
      const text=(rows[i].querySelector('.quote-special-text')?.value||'').trim();
      if(!text){showToast('Enter text for '+rows[i].dataset.lineType+' row '+(i+1),'error');rows[i].querySelector('.quote-special-text')?.focus();return;}
      continue;
    }
    const qtyEl=rows[i].querySelector('[data-quote-qty]'), priceEl=rows[i].querySelector('[data-quote-price]');
    enforceQuoteQty(qtyEl,false);
    const qty=parseBizNumber(qtyEl?.value), price=parseBizNumber(priceEl?.value);
    const nums=[qtyEl,priceEl];
    if(qty<=0){showToast('Quantity is mandatory on line '+(i+1),'error');nums[0]?.focus();return;}
    if(price<=0){showToast('Unit price is mandatory on line '+(i+1),'error');nums[1]?.focus();return;}
  }
  // Capture pendingRFQId immediately before any async operations
  const capturedRFQId = document._pendingRFQId || null;
  const capturedEditingId = editingId;
  // Collect items first for confirmation summary
  const previewItems=[];
  document.querySelectorAll('#items-tbody tr').forEach(tr=>{
    if(tr.dataset.lineType==='heading'||tr.dataset.lineType==='note'){const t=(tr.querySelector('.quote-special-text')?.value||'').trim();if(t)previewItems.push(t);return;}
    const ta=tr.querySelector('textarea');
    if(ta){
      const desc=(ta.value||'').trim();
      if(desc) previewItems.push(desc);
    } else {
      const textInputs=tr.querySelectorAll('input:not([type="number"])');
      const desc=(textInputs[3]?.value||textInputs[1]?.value||'').trim();
      if(desc) previewItems.push(desc);
    }
  });
  const previewQno=document.getElementById('f-qno').value;
  const previewStatus=document.getElementById('f-status').value;
  const previewDisc=parseFloat(document.getElementById('f-discount').value)||0;
  // Calculate net for display
  let previewSub=0;
  document.querySelectorAll('#items-tbody tr').forEach(tr=>{
    if(tr.dataset.lineType==='heading'||tr.dataset.lineType==='note') return;
    const qty=parseBizNumber(tr.querySelector('[data-quote-qty]')?.value);
    const up=parseBizNumber(tr.querySelector('[data-quote-price]')?.value);
    previewSub+=qty*up;
  });
  const previewBvat=Math.max(0,previewSub-previewDisc);
  const previewRate=Number(currentQuoteVatRate??getQuoteVatPercent());
  const previewVat=Math.round(previewBvat*(previewRate/100)*100)/100;
  const previewNet=previewBvat+previewVat;
  // Protected transactional save: only one quotation save/confirmation may own the form.
  const quoteSaveKey='quotation:'+String(capturedEditingId||document._pendingRFQId||'new');
  if(_documentSaveLocks.has(quoteSaveKey)) return;
  _documentSaveLocks.add(quoteSaveKey);
  // Show confirmation — wrap in promise
  const confirmed = await new Promise(resolve => {
    showConfirm({
      icon: editingId ? '✏️' : '📋',
      title: editingId ? 'Save changes to quotation?' : 'Create new quotation?',
      message: editingId
        ? 'Are you sure you want to save the changes to this quotation?'
        : 'Please review the details below before saving.',
      details: {
        'Quotation No': previewQno,
        'Customer': company,
        'Status': previewStatus,
        'Items': previewItems.length + ' line item(s)',
        'Net amount (incl. VAT)': fmt(previewNet)
      },
      confirmText: editingId ? '✓ Save changes' : '✓ Create quotation',
      cancelText: '← Go back and edit',
      confirmClass: 'btn-success',
      onConfirm: () => resolve(true),
      onCancel:  () => resolve(false)
    });
  });
  if (!confirmed){_documentSaveLocks.delete(quoteSaveKey);return;}
  showBusyOverlay('quote-modal', 'Saving quotation…');
  try {

  // Resolve the FINAL quotation number only after the user confirms Save.
  // Keep it in a local variable so later DOM/UI changes cannot corrupt
  // the number used to create the quotation record.
  let finalQno='';
  let finalQnoIsProvisional=false;

  let resolvedRevision=null;
  if (capturedEditingId) {
    const existingQuotation=quotations.find(x=>x.id===capturedEditingId);
    finalQno=String(existingQuotation?.qno||document.getElementById('f-qno').value||'').trim();
  } else if (document._pendingQuotationRevision) {
    resolvedRevision=resolvePendingQuotationRevision();
    finalQno=String(resolvedRevision?.qno||'').trim();
  } else {
    const numberResult=await nextQNoSafe();
    finalQno=String(numberResult?.qno||'').trim();
    finalQnoIsProvisional=!!numberResult?.isProvisional;
  }

  if(!finalQno || finalQno==='Auto on Save'){
    showConfirm({
      icon:'⚠️',
      title:'Quotation number could not be created',
      message:'BizCore could not allocate a quotation number. The quotation has not been saved.',
      confirmText:'Try again',
      cancelText:'Continue editing',
      confirmClass:'btn-primary',
      onConfirm:()=>saveQuotation(mode)
    });
    return;
  }

  const qnoField=document.getElementById('f-qno');
  qnoField.value=finalQno;
  qnoField.dataset.reservedQno=finalQno;
  qnoField.dataset.isProvisional=finalQnoIsProvisional?'1':'0';

  if(finalQnoIsProvisional){
    showToast('Offline — quotation saved with a provisional number and will be renumbered when online','warning');
  }

  const items=[];
  document.querySelectorAll('#items-tbody tr').forEach(tr=>{
    if(tr.dataset.lineType==='heading'||tr.dataset.lineType==='note'){
      const text=(tr.querySelector('.quote-special-text')?.value||'').trim();
      if(text) items.push({lineType:tr.dataset.lineType,text});
      return;
    }
    const qty=parseBizNumber(tr.querySelector('[data-quote-qty]')?.value);
    const up=parseBizNumber(tr.querySelector('[data-quote-price]')?.value);
    const sel=tr.querySelector('select');
    const textarea=tr.querySelector('textarea');
    let desc='',code='',brand='',model='',specs='';
    if (textarea) {
      desc=(textarea.value||'').trim();
    } else {
      const textInputs=tr.querySelectorAll('input:not([type="number"])');
      code=(textInputs[0]?.value||'').trim();
      brand=(textInputs[1]?.value||'').trim();
      model=(textInputs[2]?.value||'').trim();
      desc=(textInputs[3]?.value||'').trim();
      specs=(textInputs[4]?.value||'').trim();
    }
    const rowKind = textarea ? 'scope' : 'product';
    const prodId = tr.dataset.prodId || '';
    const rowImage = tr.dataset.image || '';
    const matchedProduct = !textarea ? (products.find(p => (prodId && p.id===prodId) || (code && p.code===code) || (desc && p.name===desc)) || null) : null;
    const image = rowImage || (matchedProduct && matchedProduct.image ? matchedProduct.image : '');
    if(desc||qty||up) items.push({lineType:'item',code,brand,model,desc,specs,qty,uom:sel?.value||'Pcs',up,type:(textarea?'contracting':currentQuoteType),rowKind,prodId,image});
  });
  const qno=finalQno;
  const q={
    id:capturedEditingId||qno, qno,
    origin: capturedRFQId ? 'RFQ/Pricing' : (window._pendingQuotationOrigin || 'Direct'),
    date:quoteDateISOFromDisplay(document.getElementById('f-date').value)||new Date().toISOString().slice(0,10),
    company, contact:document.getElementById('f-contact').value.trim(),
    city:document.getElementById('f-city').value.trim(),
    ref:document.getElementById('f-ref').value.trim(),
    project:document.getElementById('f-project').value.trim(),
    status:document.getElementById('f-status').value,
    validity:parseInt(document.getElementById('f-validity').value)||7,
    delivery:(()=>{const v=document.getElementById('f-delivery').value; return v==='__add__'?getDefaultTerm(deliveryTerms):v;})(),
    payment:(()=>{const v=document.getElementById('f-payment').value; return v==='__add__'?getDefaultTerm(paymentTerms):v;})(),
    notes:document.getElementById('f-notes').value,
    internalNotes:document.getElementById('f-internal-notes').value,
    discount:parseFloat(document.getElementById('f-discount').value)||0,
    quoteType: currentQuoteType,
    taxCode: capturedEditingId ? (quotations.find(x=>x.id===capturedEditingId)?.taxCode||activeTaxSettings().code) : activeTaxSettings(document.getElementById('f-date')?.value).code,
    taxName: capturedEditingId ? (quotations.find(x=>x.id===capturedEditingId)?.taxName||activeTaxSettings().name) : activeTaxSettings(document.getElementById('f-date')?.value).name,
    taxEffectiveFrom: capturedEditingId ? (quotations.find(x=>x.id===capturedEditingId)?.taxEffectiveFrom||activeTaxSettings().effectiveFrom) : activeTaxSettings(document.getElementById('f-date')?.value).effectiveFrom,
    vatRate: Number(currentQuoteVatRate??getQuoteVatPercent()),
    vatSource: capturedEditingId ? (quotations.find(x=>x.id===capturedEditingId)?.vatSource||'Document Snapshot') : 'Tax Master Snapshot',
    items, custId:selectedCustId,
    rfqId: capturedEditingId ? (quotations.find(x=>x.id===capturedEditingId)?.rfqId||null) : (capturedRFQId||null),
    pricingVersion: capturedEditingId ? (quotations.find(x=>x.id===capturedEditingId)?.pricingVersion||1) : (document._pendingPricingVersion||1),
    revisionNo: capturedEditingId ? (quotations.find(x=>x.id===capturedEditingId)?.revisionNo||0) : (resolvedRevision?.revisionNo||0),
    revisionOf: capturedEditingId ? (quotations.find(x=>x.id===capturedEditingId)?.revisionOf||null) : (resolvedRevision?.revisionOf||null),
    created:capturedEditingId?(quotations.find(x=>x.id===capturedEditingId)?.created||new Date().toISOString()):new Date().toISOString(),
    updated:new Date().toISOString()
  };
  if(capturedEditingId){
    const idx=quotations.findIndex(x=>x.id===capturedEditingId);
    if(idx>-1) quotations[idx]=q;
    else {
      showToast('Quotation record could not be located for update','error');
      return;
    }
  } else {
    // Prevent accidental duplicate insertion if the save action is retried.
    const duplicate=quotations.find(x=>x.id===q.id || x.qno===q.qno);
    if(duplicate){
      showToast('Quotation '+q.qno+' already exists. Save was not duplicated.','warning');
      return;
    }
    quotations.unshift(q);
  }

  // Verify the record exists in memory before persistence.
  if(!quotations.some(x=>x.id===q.id && x.qno===q.qno)){
    showToast('Quotation could not be created. No data was saved.','error');
    return;
  }

  // Revision becomes real only after successful quotation save.
  if(!capturedEditingId && q.revisionNo>0 && q.revisionOf){
    const familyBase=String(q.qno||'').replace(/-R\d+$/i,'');
    quotations.forEach(old=>{
      if(old.id===q.id)return;
      const oldBase=String(old.qno||'').replace(/-R\d+$/i,'');
      if(oldBase===familyBase){
        old.revisionState='Superseded';
        old.supersededBy=q.id;
      }
    });
    q.revisionState='Current';
  }

  // Link back to RFQ if converted from pricing
  let _rfqNeedsSave=false;
  if (capturedRFQId && !capturedEditingId) {
    const rfq = rfqs.find(x=>x.id===capturedRFQId);
    if (rfq) {
      ensurePricingVersions(rfq);
      const pv=rfq.pricingVersions.find(v=>Number(v.version)===Number(document._pendingPricingVersion||rfq.currentPricingVersion||1));
      if(pv){
        if(Number(pv.version)>1) rfq.pricingVersions.filter(v=>Number(v.version)<Number(pv.version)&&v.status==='Converted').forEach(v=>v.status='Superseded');
        pv.status='Converted';pv.quotationId=q.id;pv.convertedDate=new Date().toISOString();pv.updated=new Date().toISOString();
      }
      if(q.revisionNo>0){
        const prior=(rfq.quotationIds||[]).map(id=>quotations.find(x=>x.id===id)).filter(Boolean);
        prior.forEach(old=>{old.supersededBy=q.id;old.revisionState='Superseded';});
        q.revisionState='Current';
      }
      rfq.quotationIds=Array.from(new Set([...(rfq.quotationIds||[]),q.id]));
      rfq.quotationId=q.id; rfq.quotedDate=q.date; rfq.status='Quoted'; _rfqNeedsSave=true;
    }
    document._pendingRFQId = null; document._pendingPricingVersion=null; document._pendingQuotationRevision=null;
  }

  // Every mutation above is in-memory only up to this point — persist
  // the final state in one round trip per collection (run together,
  // not one after another) instead of saving after each intermediate step.
  await Promise.all([
    saveQuotations(),
    _rfqNeedsSave ? saveRFQs() : Promise.resolve()
  ]);
  if (_rfqNeedsSave) renderRFQPage();

  clearDirty(); window._pendingQuotationOrigin=null; setQuotationPricingContext(null); closeModal('quote-modal');
  if(!capturedEditingId) resetQuotationRegisterFiltersForNewRecord();
  renderAll();
  if(typeof renderTable==='function')renderTable();
  if(typeof renderPricingDocuments==='function')renderPricingDocuments();
  showToast(capturedEditingId?'Quotation updated':'Quotation '+q.qno+' created','success');
  if(mode==='preview') setTimeout(()=>viewQuotation(q.id),80);
  return q;
  } finally { _documentSaveLocks.delete(quoteSaveKey); hideBusyOverlay('quote-modal'); }
}

/* ── VIEW QUOTATION ── */

function getSalesOrderForQuotation(quotationId) {
  return salesOrders.find(so => so.quotationId === quotationId) || null;
}

function openQuotationDocument(quotationId) {
  closeModal('so-view-modal');
  closeModal('dn-print-modal');
  closeDocumentSummary();
  viewQuotation(quotationId);
}
function openSalesOrderDocument(soId) {
  closeModal('view-modal');
  closeModal('dn-print-modal');
  closeDocumentSummary();
  viewSO(soId);
}
function openDeliveryDocument(soId, deliveryIdx) {
  closeModal('view-modal');
  closeModal('so-view-modal');
  closeDocumentSummary();
  viewDeliveryNote(soId, deliveryIdx);
}
function ensureDocumentSummaryModal() {
  let modal = document.getElementById('document-summary-modal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'document-summary-modal';
  modal.innerHTML = `<div class="modal" style="width:min(620px,92vw);max-height:86vh"><div class="modal-header"><h2 id="document-summary-title">Document</h2><button class="close-btn" onclick="closeDocumentSummary()">&#10005;</button></div><div class="modal-body" id="document-summary-body"></div><div class="modal-footer"><button class="btn btn-secondary" onclick="closeDocumentSummary()">Close</button></div></div>`;
  document.body.appendChild(modal);
  return modal;
}
function closeDocumentSummary() {
  const modal = document.getElementById('document-summary-modal');
  if (modal) modal.classList.remove('open');
}
function openInvoiceDocument(soId, invoiceIdx) {
  const so = salesOrders.find(x => x.id === soId); if (!so) return;
  const inv = (so.invoices || [])[invoiceIdx]; if (!inv) return;
  const q = quotations.find(x => x.id === so.quotationId);
  closeModal('view-modal'); closeModal('so-view-modal'); closeModal('dn-print-modal');
  const modal = ensureDocumentSummaryModal();
  document.getElementById('document-summary-title').textContent = inv.invNo + ' — Customer Invoice';
  document.getElementById('document-summary-body').innerHTML = `<div class="section-title" style="margin-top:0">Invoice information</div><div class="detail-row"><span class="dk">Invoice number</span><strong style="color:var(--blue)">${inv.invNo}</strong></div><div class="detail-row"><span class="dk">Customer</span><strong>${so.customer}</strong></div><div class="detail-row"><span class="dk">Invoice date</span><span>${fmtDate(inv.date)}</span></div><div class="detail-row"><span class="dk">Due date</span><span>${fmtDate(inv.dueDate)}</span></div><div class="detail-row"><span class="dk">Zoho reference</span><span>${inv.zohoNo||'—'}</span></div><div class="detail-row"><span class="dk">Total</span><strong>${fmt(inv.total)}</strong></div>${inv.notes?`<div class="detail-row"><span class="dk">Notes</span><span>${inv.notes}</span></div>`:''}<div class="section-title">Document flow</div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${q?`<button class="btn btn-secondary" onclick="openQuotationDocument('${q.id}')"><i class="ti ti-file-description"></i>${q.qno}</button><span style="color:var(--gray)">→</span>`:''}<button class="btn btn-secondary" onclick="openSalesOrderDocument('${so.id}')"><i class="ti ti-shopping-cart"></i>${so.soNo}</button><span style="color:var(--gray)">→</span><button class="btn btn-primary" disabled><i class="ti ti-file-invoice"></i>${inv.invNo}</button></div>`;
  modal.classList.add('open');
}
function buildDocumentFlowHtml(q, so) {
  const qButton = `<button class="btn btn-secondary" style="padding:6px 10px" onclick="openQuotationDocument('${q.id}')"><i class="ti ti-file-description"></i>${q.qno}</button>`;
  if (!so) return `<div class="section-title">Document flow</div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;border:1px solid var(--border);border-radius:8px;padding:12px;background:#fbfcfe;margin-bottom:14px">${qButton}<span style="color:var(--gray)">→</span><span class="badge badge-gray">Sales Order not created</span></div>`;
  const soButton = `<button class="btn btn-secondary" style="padding:6px 10px" onclick="openSalesOrderDocument('${so.id}')"><i class="ti ti-shopping-cart"></i>${so.soNo}</button>`;
  const dns = (so.deliveries||[]).map((d,i)=>`<button class="btn btn-secondary" style="padding:6px 10px" onclick="openDeliveryDocument('${so.id}',${i})"><i class="ti ti-truck"></i>${d.dnNo}</button>`).join('');
  const invs = (so.invoices||[]).map((inv,i)=>`<button class="btn btn-secondary" style="padding:6px 10px" onclick="openInvoiceDocument('${so.id}',${i})"><i class="ti ti-file-invoice"></i>${inv.invNo}</button>`).join('');
  return `<div class="section-title">Document flow</div><div style="border:1px solid var(--border);border-radius:8px;padding:12px;background:#fbfcfe;margin-bottom:14px"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${qButton}<span style="color:var(--gray)">→</span>${soButton}${dns?`<span style="color:var(--gray)">→</span>${dns}`:''}${invs?`<span style="color:var(--gray)">→</span>${invs}`:''}</div></div>`;
}

function toggleQuotationViewSection(btn){
  const content=btn.nextElementSibling;if(!content)return;
  const open=content.style.display!=='none';content.style.display=open?'none':'block';
  const icon=btn.querySelector('.qv-chevron');if(icon)icon.className='ti '+(open?'ti-chevron-down':'ti-chevron-up')+' qv-chevron';
}
let currentViewQuotationId=null;
function viewQuotation(id, skipVatCheck=false) {
  currentViewQuotationId=id;
  const q=quotations.find(x=>x.id===id); if(!q) return;
  const activeTax=activeTaxSettings(), savedVat=getQuoteVatPercent(q), defaultVat=Number(activeTax.rate)||0;
  if((q.status||'Draft')==='Draft' && !skipVatCheck && Math.abs(savedVat-defaultVat)>0.000001){
    showConfirm({icon:'%',title:'Default VAT rate has changed',message:`This draft quotation uses ${savedVat.toFixed(2).replace(/\.00$/,'')}% VAT, while the current default is ${defaultVat.toFixed(2).replace(/\.00$/,'')}%. Which rate should this draft use?`,details:{Quotation:q.qno,'Saved VAT':savedVat.toFixed(2).replace(/\.00$/,'')+'%','Current default':defaultVat.toFixed(2).replace(/\.00$/,'')+'%'},confirmText:'Apply new VAT',cancelText:'Keep current VAT',confirmClass:'btn-primary',onConfirm:()=>{q.vatRate=defaultVat;q.taxCode=activeTax.code;q.taxName=activeTax.name;q.taxEffectiveFrom=activeTax.effectiveFrom;q.vatSource='Updated from Tax Master';q.updated=new Date().toISOString();saveQuotations().then(()=>viewQuotation(id,true));},onCancel:()=>viewQuotation(id,true)});return;
  }
  const linkedSO=getSalesOrderForQuotation(q.id), totals=calcQuote(q), vu=validUntil(q);
  const lRFQ=q.rfqId?rfqs.find(r=>r.id===q.rfqId):null;
  const hPricing=!!(lRFQ&&lRFQ.pricingItems&&lRFQ.pricingItems.length);
  const status=q.status||'Draft';
  document.getElementById('view-title').innerHTML='<span class="qv-title-kicker">Quotation</span><span class="qv-title-number">'+escapeHtml(q.qno)+'</span>';
  renderStatusBar(q,status);

  let itemNo=0;
  const items=(q.items||[]).map(it=>{
    if(it.lineType==='heading') return '<tr class="qv-heading"><td colspan="6"><i class="ti ti-heading" style="margin-right:7px"></i>'+escapeHtml(it.text||it.desc||'')+'</td></tr>';
    if(it.lineType==='note') return '<tr class="qv-note"><td></td><td colspan="5"><span class="qv-note-badge">Note</span>'+escapeHtml(it.text||it.desc||'')+'</td></tr>';
    itemNo++;
    const total=(parseFloat(it.qty)||0)*(parseFloat(it.up)||0), service=it.type==='service';
    const title=escapeHtml(it.desc||'—');
    const sub=[!service&&it.specs?escapeHtml(it.specs):'',!service&&[it.brand,it.model].filter(Boolean).length?escapeHtml([it.brand,it.model].filter(Boolean).join(' / ')):''].filter(Boolean).join(' · ');
    return '<tr class="qv-item"><td class="center">'+String(itemNo).padStart(3,'0')+'</td><td><div class="qv-desc-title">'+title+'</div>'+(sub?'<div class="qv-desc-sub">'+sub+'</div>':'')+'</td><td class="center">'+escapeHtml(String(it.qty??''))+'</td><td class="center">'+escapeHtml(it.uom||'')+'</td><td class="num">'+qvLineUnitMoney(it.up)+'</td><td class="num"><strong>'+qvLineAmountMoney(total)+'</strong></td></tr>';
  }).join('')||'<tr><td colspan="6" style="padding:20px;text-align:center;color:#64748b">No line items</td></tr>';

  let margin='—', pricingCost=0, pricingSell=0;
  if(hPricing){pricingCost=lRFQ.pricingItems.reduce((s,i)=>s+(parseFloat(i.buy)||0)*(parseFloat(i.qty)||0),0);pricingSell=lRFQ.pricingItems.reduce((s,i)=>s+(parseFloat(i.sell)||0)*(parseFloat(i.qty)||0),0);margin=pricingCost?(((pricingSell-pricingCost)/pricingCost)*100).toFixed(1)+'%':'0.0%';}
  const grossProfit=hPricing?(totals.sub-pricingCost):null;
  const notes=q.notes?escapeHtml(q.notes):'No customer notes recorded.';
  const internal=escapeHtml(q.internalNotes||q.internalnotes||'No internal notes recorded.');
  const cust=customers.find(c=>String(c.id)===String(q.custId||''))||customers.find(c=>normalizeMasterValue(c.company)===normalizeMasterValue(q.company));
  const custAddr1=cust?[cust.buildingNo,cust.street].filter(Boolean).join(' '):'';
  const custAddr2=cust?[cust.district,cust.city,cust.postalCode].filter(Boolean).join(', '):(q.city||'');
  const custCountry=cust?.country||'';
  const co=settings.coname||'Downtown Trading Est.';
  const coAddr=[buildAddressLine1(settings),buildAddressLine2(settings)].filter(Boolean).join(' · ');
  const logoHtml=settings.logo?'<img class="qdoc-logo" src="'+settings.logo+'" alt="'+escapeHtml(co)+'">':'<div class="qdoc-logo-fallback">DT</div>';
  const qRevision=Number(q.revision||q.rev||0);
  const flowNodes=[
    lRFQ?'<button class="qv-doc-node" data-rfqid="'+escapeHtml(q.rfqId||'')+'" onclick="viewRFQFromQuote(this)"><small>RFQ</small><strong>'+escapeHtml(lRFQ.rfqNo||'RFQ')+'</strong></button>':'<div class="qv-doc-node muted"><small>RFQ</small><strong>Not linked</strong></div>',
    hPricing?'<button class="qv-doc-node" data-rfqid="'+escapeHtml(q.rfqId||'')+'" onclick="viewPricingFromQuote(this)"><small>PRICING</small><strong>'+escapeHtml(lRFQ.pricingNo||lRFQ.rfqNo||'Pricing')+'</strong></button>':'<div class="qv-doc-node muted"><small>PRICING</small><strong>Not linked</strong></div>',
    '<div class="qv-doc-node current"><small>QUOTATION</small><strong>'+escapeHtml(q.qno)+'</strong></div>',
    linkedSO?'<button class="qv-doc-node" data-soid="'+linkedSO.id+'" onclick="openSalesOrderDocument(this.dataset.soid)"><small>SALES ORDER</small><strong>'+escapeHtml(linkedSO.soNo)+'</strong></button>':'<div class="qv-doc-node muted"><small>SALES ORDER</small><strong>Not created</strong></div>'
  ];
  const flowHtml=flowNodes.map((n,i)=>n+(i<flowNodes.length-1?'<span class="qv-doc-arrow"><i class="ti ti-chevron-down"></i></span>':'')).join('');
  const activityRows=[
    ['Created',q.created||q.date,'ti-file-plus'],
    qRevision>0?['Revision '+qRevision,q.updated||q.date,'ti-git-branch']:null,
    ['Current status: '+status,q.updated||q.date,'ti-tag'],
    linkedSO?['Converted to '+linkedSO.soNo,linkedSO.created||linkedSO.date,'ti-shopping-cart']:null
  ].filter(Boolean).map(a=>'<div class="qv-activity-row"><span class="qv-activity-icon"><i class="ti '+a[2]+'"></i></span><div><strong>'+escapeHtml(a[0])+'</strong><span>'+(a[1]?fmtDate(a[1]):'—')+'</span></div></div>').join('');

  document.getElementById('view-body').innerHTML=`
    <div class="qv-document-workspace">
      <main class="qv-document-column">
        <article class="qdoc-sheet" aria-label="Official quotation document preview">
          <header class="qdoc-header">
            <div class="qdoc-brand">${logoHtml}<div><h3>${escapeHtml(co)}</h3><p>${escapeHtml(coAddr||settings.tagline||'')}</p></div></div>
            <div class="qdoc-title"><span>QUOTATION</span><strong>${escapeHtml(q.qno)}</strong><small>${qRevision?`Revision R${qRevision}`:'Official quotation'}</small></div>
          </header>
          <section class="qdoc-meta">
            <div class="qdoc-party"><span class="qdoc-eyebrow">QUOTATION TO</span><h4>${escapeHtml(q.company||'—')}</h4>${custAddr1?`<p>${escapeHtml(custAddr1)}</p>`:''}${custAddr2?`<p>${escapeHtml(custAddr2)}</p>`:''}${custCountry?`<p>${escapeHtml(custCountry)}</p>`:''}${cust?.vat?`<p class="qdoc-muted">VAT No. ${escapeHtml(cust.vat)}</p>`:''}${q.contact?`<p class="qdoc-muted">Attn: ${escapeHtml(q.contact)}</p>`:''}</div>
            <div class="qdoc-details"><div><span>Quotation date</span><strong>${fmtDate(q.date)}</strong></div><div><span>Valid until</span><strong>${fmtDate(vu)}</strong></div><div><span>Customer ref.</span><strong>${escapeHtml(q.ref||'—')}</strong></div><div><span>Payment</span><strong>${escapeHtml(q.payment||'—')}</strong></div><div><span>Delivery</span><strong>${escapeHtml(q.delivery||'—')}</strong></div><div><span>VAT</span><strong>${savedVat}%</strong></div></div>
          </section>
          <section class="qdoc-items"><table><thead><tr><th class="center">SL</th><th>Description</th><th class="center">Qty</th><th class="center">UOM</th><th class="num">Unit Price</th><th class="num">Amount</th></tr></thead><tbody>${items}</tbody></table></section>
          <section class="qdoc-bottom">
            <div class="qdoc-terms"><span class="qdoc-eyebrow">NOTES / TERMS</span><div>${notes}</div></div>
            <div class="qdoc-totals"><div><span>Subtotal</span><strong>${qvSummaryMoney(totals.sub)}</strong></div>${totals.disc>0?`<div><span>Discount</span><strong>- ${qvSummaryMoney(totals.disc)}</strong></div>`:''}<div><span>VAT (${savedVat}%)</span><strong>${qvSummaryMoney(totals.vat)}</strong></div><div class="grand"><span>Grand Total</span><strong>${qvGrandTotalMoney(totals.net)}</strong></div></div>
          </section>
          <footer class="qdoc-footer"><div><strong>${escapeHtml(settings.closingMessage||'Thank you for the opportunity to serve you.')}</strong><span>${escapeHtml(buildPrintFooterAddress(settings)||'')}</span></div><div class="qdoc-sign">Authorized Signature</div></footer>
        </article>
      </main>
      <aside class="qv-erp-panel">
        <section class="qv-side-card qv-internal-card"><div class="qv-side-head"><span><i class="ti ti-lock"></i>Internal information</span><span class="qv-screen-only">Staff only</span></div><div class="qv-side-body">
          <div class="qv-side-row"><span>Pricing reference</span><strong>${hPricing?escapeHtml(lRFQ.pricingNo||lRFQ.rfqNo||'Linked'):'—'}</strong></div>
          <div class="qv-side-row"><span>Estimated cost</span><strong>${hPricing?qvSummaryMoney(pricingCost):'—'}</strong></div>
          <div class="qv-side-row"><span>Gross profit</span><strong>${grossProfit!==null?qvSummaryMoney(grossProfit):'—'}</strong></div>
          <div class="qv-side-row"><span>Margin</span><strong>${margin}</strong></div>
          <div class="qv-side-row"><span>Revision</span><strong>${qRevision||'Original'}</strong></div>
          <div class="qv-internal-note"><span>Internal note</span><p>${internal}</p></div>
        </div></section>
        <section class="qv-side-card"><div class="qv-side-head"><span><i class="ti ti-route"></i>Document flow</span></div><div class="qv-side-body qv-doc-flow">${flowHtml}</div></section>
        <section class="qv-side-card"><div class="qv-side-head"><span><i class="ti ti-history"></i>Document activity</span></div><div class="qv-side-body qv-activity">${activityRows}</div></section>
      </aside>
    </div>`;

  const buttons=[];
  buttons.push('<button class="btn btn-secondary" onclick="closeModal(\'view-modal\')">Close</button>');
  if(lRFQ) buttons.push('<button class="btn btn-secondary" data-rfqid="'+q.rfqId+'" onclick="viewRFQFromQuote(this)"><i class="ti ti-clipboard-list"></i>RFQ</button>');
  if(hPricing) buttons.push('<button class="btn btn-secondary" data-rfqid="'+q.rfqId+'" onclick="viewPricingFromQuote(this)"><i class="ti ti-calculator"></i>Pricing</button>');
  if(status==='Draft') buttons.push('<button class="btn btn-secondary" data-qid="'+q.id+'" onclick="transitionToQuotationEdit(this)"><i class="ti ti-edit"></i>Edit</button>');
  else buttons.push('<button class="btn btn-secondary" data-qid="'+q.id+'" onclick="createQuotationRevision(this.dataset.qid)"><i class="ti ti-git-branch"></i>Revise</button>');
  buttons.push('<button class="btn btn-secondary" data-qid="'+q.id+'" onclick="duplicateQuotation(this.dataset.qid)"><i class="ti ti-copy"></i>Duplicate</button>');
  if(linkedSO) buttons.push('<button class="btn btn-success" data-soid="'+linkedSO.id+'" onclick="openSalesOrderDocument(this.dataset.soid)"><i class="ti ti-external-link"></i>'+escapeHtml(linkedSO.soNo)+'</button>');
  if(status==='Won' && !getQuotationSOProgress(q.id).complete) buttons.push('<button class="btn btn-success" data-qid="'+q.id+'" onclick="transitionQuotationToSO(this)"><i class="ti ti-shopping-cart"></i>'+(linkedSO?'Create Remaining SO':'Create Sales Order')+'</button>');
  buttons.push('<button class="btn btn-primary" data-qid="'+q.id+'" onclick="openTemplatePicker(this.dataset.qid)"><i class="ti ti-printer"></i>Print / PDF</button>');
  // Delete / Cancel — mutually exclusive, rules enforced inside each function
  if (!linkedSO) {
    if (status === 'Draft') {
      buttons.push('<button class="btn btn-sm" style="background:#FEF2F2;color:#DC2626;border:1px solid #FECACA" data-qid="'+q.id+'" onclick="deleteQuotation(this.dataset.qid)"><i class="ti ti-trash"></i> Delete</button>');
    } else if (status !== 'Cancelled') {
      buttons.push('<button class="btn btn-sm" style="background:#FFF7ED;color:#C2410C;border:1px solid #FED7AA" data-qid="'+q.id+'" onclick="cancelQuotation(this.dataset.qid)"><i class="ti ti-ban"></i> Cancel</button>');
    }
  }
  document.getElementById('view-footer').innerHTML=buttons.join('');
  openModalWithSize('view-modal');
}

async function updateStatus(id, status) {
  // Just a visual selection — does NOT save yet
  const q = quotations.find(x=>x.id===id); if (!q) return;
  if (status === q.status) {
    // Clicking current status again = undo any pending selection
    renderStatusBar(q, q.status);
    return;
  }
  // Highlight selected button, show Save + Undo in bar
  renderStatusBar(q, status, true);
}

async function commitStatus(id, newStatus) {
  const q = quotations.find(x=>x.id===id); if (!q) return;
  const oldStatus = q.status;
  q.status = newStatus;
  q.updated = new Date().toISOString();
  await saveQuotations();
  renderAll();
  renderStatusBar(q, newStatus);
  showToast('Status changed: ' + oldStatus + ' → ' + newStatus, 'success');

  // If marked Won → prompt to create Sales Order immediately
  if (newStatus === 'Won') {
    // Also update the view footer so the button appears right now
    viewQuotation(id);
    // Small delay so the toast and footer update render first
    setTimeout(() => {
      showConfirm({
        icon: '🎉',
        title: 'Quotation Won!',
        message: q.qno + ' — ' + q.company,
        details: {
          'Total value': fmt(calcQuote(q).net),
          'Next step':   'Create a Sales Order to start order tracking',
        },
        confirmText: '🛒 Create Sales Order now',
        cancelText:  '⏱ I\'ll do it later',
        confirmClass: 'btn-success',
        onConfirm: () => transitionQuotationToSO(id),
        onCancel: () => {}, // just close the dialog, button is already in footer
      });
    }, 400);
  }
}

function renderStatusBar(q, selectedStatus, pending) {
  const statusBar = document.getElementById('view-status-bar');
  const statusBtns = ['Draft','Sent','Won','Lost','Expired','Revised'].map(function(s) {
    const colorCls = 'sbtn sbtn-' + s.toLowerCase();
    const isActive = s === selectedStatus;
    const isSaved  = s === q.status;
    // pending = user picked a new status but hasn't saved yet
    const activeCls = isActive ? ' active' : '';
    const pendingStyle = (pending && isActive) ? ' style="outline:3px solid #ffc107;outline-offset:2px"' : '';
    return '<button class="' + colorCls + activeCls + '"' + pendingStyle
      + ' data-qid="' + q.id + '" data-st="' + s + '"'
      + ' onclick="updateStatus(this.dataset.qid,this.dataset.st)">' + s + '</button>';
  }).join('');

  let actionHtml = '';
  if (pending) {
    actionHtml =
      '<span style="font-size:11px;color:var(--orange-txt);font-weight:600;margin-left:4px"><i class="ti ti-alert-triangle"></i> Not saved yet</span>'
      + '<button class="btn btn-success ssb-save" data-qid="' + q.id + '" data-st="' + selectedStatus + '"'
      + ' onclick="commitStatus(this.dataset.qid,this.dataset.st)"><i class="ti ti-check"></i>Save status</button>'
      + '<button class="btn btn-secondary ssb-undo" data-qid="' + q.id + '"'
      + ' onclick="renderStatusBar(quotations.find(x=>x.id===this.dataset.qid),quotations.find(x=>x.id===this.dataset.qid).status)">Undo</button>';
  }

  statusBar.innerHTML = '<span class="ssb-label"><i class="ti ti-tag" style="margin-right:4px"></i>Status:</span>'
    + statusBtns + actionHtml;
}


function createQuotationRevision(id){
  const q=quotations.find(x=>x.id===id);if(!q)return;
  closeModal('view-modal');

  editingId=null;
  currentQuoteVatRate=getQuoteVatPercent(q);
  document._pendingRFQId=q.rfqId||null;
  document._pendingPricingVersion=q.pricingVersion||1;
  document._pendingQuotationRevision={
    sourceQuotationId:q.id,
    baseQno:String(q.qno||'').replace(/-R\d+$/i,''),
    revisionOf:q.revisionOf||q.id
  };

  document.getElementById('modal-title').textContent='Revise quotation — '+q.qno;

  const c=customers.find(x=>x.company===q.company);
  if(c){
    selectedCustId=c.id;
    document.getElementById('f-cust-search').value=c.company;
    document.getElementById('f-cust-search').classList.add('cust-locked');
  }else{
    selectedCustId=q.custId||'__legacy__';
    document.getElementById('f-cust-search').value=q.company||'';
    document.getElementById('f-cust-search').classList.add('cust-locked');
  }

  document.getElementById('f-company').value=q.company||'';
  document.getElementById('f-contact').value=q.contact||'';
  document.getElementById('f-contact').classList.remove('cust-locked');
  document.getElementById('f-contact-hint').style.display='none';
  document.getElementById('f-city').value=q.city||'';
  document.getElementById('f-ref').value=q.ref||'';
  document.getElementById('f-project').value=q.project||'';
  document.getElementById('f-qno').value='Auto on Save';
  document.getElementById('f-qno').dataset.reservedQno='';
  document.getElementById('f-qno').dataset.isProvisional='0';
  document.getElementById('f-date').value=todayQuoteDateDisplay();
  document.getElementById('f-status').value='Draft';
  document.getElementById('f-validity').value=q.validity||7;

  populateTermsSelect('delivery');
  populateTermsSelect('payment');
  ['delivery','payment'].forEach(type=>{
    const savedVal=type==='delivery'?(q.delivery||''):(q.payment||'');
    const selId=type==='delivery'?'f-delivery':'f-payment';
    const list=type==='delivery'?deliveryTerms:paymentTerms;
    if(savedVal&&!list.some(t=>t.text===savedVal)){
      const sel=document.getElementById(selId);
      const opt=document.createElement('option');
      opt.value=savedVal;opt.textContent=savedVal;sel.insertBefore(opt,sel.firstChild);
    }
    if(savedVal)document.getElementById(selId).value=savedVal;
  });

  document.getElementById('f-notes').value=q.notes||'';
  document.getElementById('f-internal-notes').value=q.internalNotes||'';
  document.getElementById('f-discount').value=q.discount||0;

  const savedType=q.quoteType||(q.items||[])[0]?.type||'product';
  currentQuoteType=savedType==='contracting'?'contracting':'product';
  setQuoteType(currentQuoteType,{locked:true});
  document.getElementById('items-tbody').innerHTML='';
  (q.items||[]).forEach(it=>addItemRow(JSON.parse(JSON.stringify(it))));
  if(!q.items||!q.items.length)addItemRow();
  calcTotals();
  updateValidUntil();
  updateQuoteHeaderSummary();
  setQuoteFormState('saved');
  openModalWithSize('quote-modal');
  showToast('Revision prepared — number will be assigned only when saved','info');
}

async function duplicateQuotation(id) {
  const q=quotations.find(x=>x.id===id); if(!q) return;
  const {net}=calcQuote(q);
  // Confirmation before duplicating
  const confirmed = await new Promise(resolve => {
    showConfirm({
      icon: '📋',
      title: 'Duplicate this quotation?',
      message: 'A new draft quotation will be created with the same items and details.',
      details: {
        'Original Q No': q.qno,
        'Customer': q.company,
        'Items': (q.items||[]).length + ' line item(s)',
        'Net amount': fmt(net),
        'New status': 'Draft (today date)'
      },
      confirmText: '✓ Yes, duplicate',
      cancelText: '← Cancel',
      confirmClass: 'btn-primary',
      onConfirm: () => resolve(true),
      onCancel:  () => resolve(false)
    });
  });
  if (!confirmed) return;
  closeModal('view-modal');
  const numResult = await nextQNoSafe();
  const newQno = numResult.qno;
  const copy={...JSON.parse(JSON.stringify(q)),id:newQno,qno:newQno,
    rfqId:null, // don't inherit RFQ link — it's a new quotation
    date:new Date().toISOString().split('T')[0],
    status:'Draft',
    created:new Date().toISOString(),
    updated:new Date().toISOString()};
  quotations.unshift(copy); saveQuotations(); renderAll();
  if (numResult.isProvisional) {
    showToast('Duplicated as '+newQno+' (offline — will get final number once reconnected)','error');
  } else {
    showToast('Duplicated as '+newQno,'success');
  }
  editQuotation(newQno);
}

/* ── DELETE QUOTATION ──
   Rules (matches professional ERP practice):
   1. Only Draft quotations that have NEVER been converted to a Sales Order
      can be deleted at all.
   2. Deleting moves it to a Recycle Bin — never an immediate hard delete —
      so an accidental delete is always recoverable.
   3. Quotations linked to a Sales Order can NEVER be deleted, regardless
      of status — use Cancel instead (see cancelQuotation).
   4. For anything past Draft (Sent/Won/Lost/Expired), use Cancel — the
      number and record stay visible permanently for audit purposes. ── */
async function deleteQuotation(id) {
  const q = quotations.find(x => x.id === id);
  if (!q) return;

  const status = q.status || 'Draft';
  const linkedSO = getSalesOrderForQuotation(id);

  if (linkedSO) {
    showToast('This quotation is linked to Sales Order ' + (linkedSO.soNo||'') + ' and cannot be deleted.', 'error');
    return;
  }
  if (status !== 'Draft') {
    showToast('Only Draft quotations can be deleted. Use Cancel for quotations that have been sent.', 'error');
    return;
  }

  const confirmed = await showConfirmAsync({
    icon: '🗑️',
    title: 'Move to Recycle Bin?',
    message: 'Quotation ' + q.qno + ' will be moved to the Recycle Bin. You can restore it later, or it will remain there until permanently removed.',
    confirmText: 'Move to Recycle Bin',
    confirmClass: 'btn-danger'
  });
  if (!confirmed) return;

  // Unlink from any RFQ that references this quotation
  const linkedRFQ = rfqs.find(r => r.quotationId === id);
  if (linkedRFQ) {
    linkedRFQ.quotationId = null;
    linkedRFQ.quotedDate  = null;
    linkedRFQ.status      = 'Pricing';
  }

  // Move to recycle bin instead of deleting outright
  const binEntry = {
    ...JSON.parse(JSON.stringify(q)),
    deletedAt: new Date().toISOString(),
    deletedBy: (window.currentUser && window.currentUser.email) || 'unknown',
    originalCollection: 'quotations'
  };
  recycleBin.push(binEntry);

  // Remove from active quotations — but the number is NEVER reused,
  // since nextQNoSafe() always pulls from the atomic Firestore counter,
  // not from the local quotations array.
  quotations = quotations.filter(x => x.id !== id);

  // All three collections above are independent of each other — save
  // them together in one round trip each instead of one after another.
  await Promise.all([
    linkedRFQ ? saveRFQs() : Promise.resolve(),
    saveRecycleBin(),
    saveQuotations()
  ]);

  renderAll();
  renderRFQPage();
  showToast('Moved to Recycle Bin — ' + q.qno + ' can be restored anytime', 'success');
}

/* ── CANCEL QUOTATION ──
   Used once a quotation has left Draft status. The record and its number
   stay permanently — status changes to "Cancelled" with a required reason
   for the audit trail. ── */
async function cancelQuotation(id) {
  const q = quotations.find(x => x.id === id);
  if (!q) return;

  const linkedSO = getSalesOrderForQuotation(id);
  if (linkedSO) {
    showToast('This quotation is linked to Sales Order ' + (linkedSO.soNo||'') + ' and cannot be cancelled here.', 'error');
    return;
  }
  if (q.status === 'Cancelled') {
    showToast('This quotation is already cancelled.', 'error');
    return;
  }

  const reason = await showReasonPrompt({
    icon: '⛔',
    title: 'Cancel ' + q.qno + '?',
    message: 'This quotation will be marked Cancelled. It stays visible in reports and history — its number is never reused.',
    placeholder: 'Reason for cancellation (required)',
    confirmText: 'Cancel Quotation'
  });
  if (!reason) return; // user backed out or gave no reason

  q.previousStatus  = q.status;
  q.status          = 'Cancelled';
  q.cancelledAt     = new Date().toISOString();
  q.cancelledBy     = (window.currentUser && window.currentUser.email) || 'unknown';
  q.cancellationReason = reason;
  q.updated         = new Date().toISOString();

  await saveQuotations();
  renderAll();
  closeModal('view-modal');
  showToast(q.qno + ' has been cancelled', 'success');
}

/* ── Small prompt dialog that requires a typed reason before confirming ── */
function showReasonPrompt(opts) {
  return new Promise(function(resolve) {
    const existing = document.getElementById('reason-prompt-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'reason-prompt-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML =
      '<div style="background:#fff;border-radius:12px;padding:28px;max-width:400px;width:100%;box-shadow:0 16px 48px rgba(0,0,0,.2)">'
      + '<div style="font-size:22px;margin-bottom:10px">' + (opts.icon||'⚠️') + '</div>'
      + '<div style="font-size:15px;font-weight:700;margin-bottom:8px">' + (opts.title||'Confirm') + '</div>'
      + '<div style="font-size:13px;color:#5A6677;margin-bottom:14px">' + (opts.message||'') + '</div>'
      + '<textarea id="reason-prompt-input" placeholder="' + (opts.placeholder||'Reason') + '" '
      + 'style="width:100%;min-height:70px;border:1.5px solid #E2E8F0;border-radius:7px;padding:10px;font-size:13px;font-family:inherit;resize:vertical;margin-bottom:16px"></textarea>'
      + '<div style="display:flex;gap:10px;justify-content:flex-end">'
      + '<button id="reason-prompt-cancel" style="height:36px;padding:0 16px;border:1.5px solid #E2E8F0;border-radius:7px;background:#fff;cursor:pointer;font-size:13px;font-weight:600">Back</button>'
      + '<button id="reason-prompt-confirm" style="height:36px;padding:0 16px;border:none;border-radius:7px;background:#DC2626;color:#fff;cursor:pointer;font-size:13px;font-weight:600">' + (opts.confirmText||'Confirm') + '</button>'
      + '</div></div>';
    document.body.appendChild(modal);

    const input = document.getElementById('reason-prompt-input');
    input.focus();

    document.getElementById('reason-prompt-cancel').onclick = function() {
      modal.remove();
      resolve(null);
    };
    document.getElementById('reason-prompt-confirm').onclick = function() {
      const val = input.value.trim();
      if (!val) {
        input.style.borderColor = '#DC2626';
        input.placeholder = 'A reason is required';
        return;
      }
      modal.remove();
      resolve(val);
    };
  });
}

/* ── RECYCLE BIN ── */
let recycleBin = [];

async function saveRecycleBin() {
  try { localStorage.setItem('dtq_recycle_bin', JSON.stringify(recycleBin)); } catch(e) {}
  if (window.FB) await window.FB.fbSave('recycleBin', recycleBin);
}

async function loadRecycleBin() {
  if (window.FB) {
    try {
      const fbBin = await window.FB.fbLoad('recycleBin');
      if (fbBin) { recycleBin = fbBin; return; }
    } catch(e) {}
  }
  try {
    const r = localStorage.getItem('dtq_recycle_bin');
    if (r) recycleBin = JSON.parse(r);
  } catch(e) {}
}

const RECYCLE_BIN_TYPES = {
  quotations: {
    label: 'Quotations',
    icon: 'ti-file-invoice',
    titleOf: item => item.qno || 'Quotation',
    subtitleOf: item => item.company || '',
    restoreArray: () => quotations,
    restoreSave: saveQuotations,
  },
  employees: {
    label: 'Employees',
    icon: 'ti-users',
    titleOf: item => item.name || 'Employee',
    subtitleOf: item => item.code || '',
    restoreArray: () => employees,
    restoreSave: saveEmployees,
  },
  customers: {
    label: 'Customers',
    icon: 'ti-users',
    titleOf: item => item.company || 'Customer',
    subtitleOf: item => item.city || '',
    restoreArray: () => customers,
    restoreSave: saveCustomers,
  },
  suppliers: {
    label: 'Suppliers',
    icon: 'ti-building-store',
    titleOf: item => item.company || 'Supplier',
    subtitleOf: item => item.city || '',
    restoreArray: () => suppliers,
    restoreSave: saveSuppliers,
  },
  products: {
    label: 'Products',
    icon: 'ti-package',
    titleOf: item => item.name || item.code || 'Product',
    subtitleOf: item => item.code || '',
    restoreArray: () => products,
    restoreSave: saveProducts,
  }
};
let recycleBinFilter = 'all';

function openRecycleBin() {
  recycleBinFilter = 'all';
  renderRecycleBin();
  openModalWithSize('recycle-bin-modal');
}

function switchRecycleBinFilter(type) {
  recycleBinFilter = type;
  renderRecycleBin();
}

function renderRecycleBin() {
  const list = document.getElementById('recycle-bin-list');
  if (!list) return;

  const tabs = document.getElementById('recycle-bin-tabs');
  if (tabs) {
    const counts = { all: recycleBin.length };
    Object.keys(RECYCLE_BIN_TYPES).forEach(k => { counts[k] = recycleBin.filter(x=>x.originalCollection===k).length; });
    tabs.innerHTML = ['all', ...Object.keys(RECYCLE_BIN_TYPES)].map(k => {
      const label = k === 'all' ? 'All' : RECYCLE_BIN_TYPES[k].label;
      return `<button type="button" class="btn btn-sm ${recycleBinFilter===k?'btn-primary':'btn-secondary'}" onclick="switchRecycleBinFilter('${k}')">${label} (${counts[k]||0})</button>`;
    }).join('');
  }

  const items = recycleBin
    .filter(x => recycleBinFilter === 'all' || x.originalCollection === recycleBinFilter)
    .sort((a,b) => new Date(b.deletedAt) - new Date(a.deletedAt));

  if (!items.length) {
    list.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--gray)">'
      + '<i class="ti ti-trash" style="font-size:36px;opacity:.3;display:block;margin-bottom:10px"></i>'
      + 'Recycle Bin is empty</div>';
    return;
  }

  list.innerHTML = items.map(function(item) {
    const cfg = RECYCLE_BIN_TYPES[item.originalCollection];
    const daysAgo = Math.floor((Date.now() - new Date(item.deletedAt).getTime()) / 86400000);
    const title = cfg ? cfg.titleOf(item) : (item.qno || item.name || 'Item');
    const subtitle = cfg ? cfg.subtitleOf(item) : '';
    const typeLabel = cfg ? cfg.label.replace(/s$/,'') : (item.originalCollection || 'Item');
    const icon = cfg ? cfg.icon : 'ti-file';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #EEF1F4">'
      + '<div style="display:flex;align-items:center;gap:10px">'
      + '<i class="ti ' + icon + '" style="color:var(--gray);font-size:18px"></i>'
      + '<div>'
      + '<div style="font-weight:700;font-size:13px;color:var(--blue)">' + esc(title) + ' <span style="font-weight:400;color:var(--gray);font-size:10px">· ' + esc(typeLabel) + '</span></div>'
      + '<div style="font-size:11px;color:var(--gray);margin-top:2px">' + esc(subtitle) + (subtitle?' &middot; ':'') + 'Deleted ' + (daysAgo===0?'today':daysAgo+' day(s) ago') + ' by ' + esc(item.deletedBy||'unknown') + '</div>'
      + '</div></div>'
      + '<div style="display:flex;gap:6px">'
      + '<button class="btn btn-secondary btn-sm" onclick="restoreFromBin(\'' + item.id + '\')"><i class="ti ti-restore"></i> Restore</button>'
      + '<button class="btn btn-sm" style="background:#FEF2F2;color:#DC2626;border:1px solid #FECACA" onclick="purgeFromBin(\'' + item.id + '\')"><i class="ti ti-trash-x"></i> Purge</button>'
      + '</div></div>';
  }).join('');
}

async function restoreFromBin(id) {
  const idx = recycleBin.findIndex(x => x.id === id);
  if (idx === -1) return;
  const item = recycleBin[idx];
  const cfg = RECYCLE_BIN_TYPES[item.originalCollection];
  if (!cfg) { showToast('This item type can no longer be restored automatically.', 'error'); return; }

  const confirmed = await showConfirmAsync({
    icon: '♻️',
    title: 'Restore ' + cfg.titleOf(item) + '?',
    message: 'This will bring it back to the active ' + cfg.label.toLowerCase() + ' list.',
    confirmText: 'Restore',
  });
  if (!confirmed) return;

  const restoredType = item.originalCollection;
  const restored = { ...item };
  delete restored.deletedAt;
  delete restored.deletedBy;
  delete restored.originalCollection;
  cfg.restoreArray().push(restored);
  recycleBin.splice(idx, 1);

  await Promise.all([cfg.restoreSave(), saveRecycleBin()]);
  renderAll();
  if(restoredType==='suppliers') renderSuppliers();
  renderRecycleBin();
  showToast(cfg.titleOf(item) + ' restored', 'success');
}

async function purgeFromBin(id) {
  const idx = recycleBin.findIndex(x => x.id === id);
  if (idx === -1) return;
  const item = recycleBin[idx];
  const cfg = RECYCLE_BIN_TYPES[item.originalCollection];
  const title = cfg ? cfg.titleOf(item) : (item.qno || item.name || 'this item');

  const confirmed = await showConfirmAsync({
    icon: '⚠️',
    title: 'Permanently delete ' + title + '?',
    message: 'This cannot be undone. The record will be permanently removed and cannot be recovered.',
    confirmText: 'Permanently Delete',
  });
  if (!confirmed) return;

  recycleBin.splice(idx, 1);
  await saveRecycleBin();
  renderRecycleBin();
  showToast(title + ' permanently deleted', 'success');
}

/* ── PRINT ── */
function printQuotation(id) {
  const q=quotations.find(x=>x.id===id); if(!q) return;
  const {sub,disc,bvat,vat,net}=calcQuote(q);
  const vu=validUntil(q);
  const co    = settings.coname||'Downtown Trading Est.';
  const addr1 = buildAddressLine1(settings);
  const addr2 = buildAddressLine2(settings);
  const logoHtml = settings.logo
    ? '<img src="'+settings.logo+'" alt="'+co+'" style="height:48px;width:auto;max-width:210px;object-fit:contain">'
    : '';

  const headerInfo = buildPrintHeaderInfo(settings);
  const footerLine1 = buildPrintFooterAddress(settings);
  const footerLine2 = buildPrintFooterInfo(settings);

  const itemRows = (q.items||[]).map(function(it,i) {
    if(it.lineType==='heading') return '<tr><td colspan="99" style="padding:7px 8px;background:#EEF4FB;color:#1F4E79;font-weight:800;border-top:1px solid #CBD5E1;border-bottom:1px solid #CBD5E1">'+escapeHtml(it.text||it.desc||'')+'</td></tr>';
    if(it.lineType==='note') return '<tr><td></td><td colspan="98" style="padding:6px 8px;background:#FFFBEA;color:#475569;font-style:italic;border-top:1px solid #EADFAE;border-bottom:1px solid #EADFAE">Note: '+escapeHtml(it.text||it.desc||'')+'</td></tr>';
    const t=(parseFloat(it.qty)||0)*(parseFloat(it.up)||0);
    const s2=[it.brand,it.model].filter(Boolean).join(' \u00b7 ');
    return '<tr>'
      +'<td class="num">'+String(i+1).padStart(2,'0')+'</td>'
      +'<td><div>'+(it.desc||'')+'</div>'
      +(s2?'<div class="dsub">'+s2+'</div>':'')
      +(it.specs?'<div class="dsub">'+it.specs+'</div>':'')
      +'</td>'
      +'<td class="r">'+it.qty+'</td>'
      +'<td class="c">'+(it.uom||'')+'</td>'
      +'<td class="r">'+Number(it.up).toLocaleString('en',{minimumFractionDigits:2})+'</td>'
      +'<td class="r">'+t.toLocaleString('en',{minimumFractionDigits:2})+'</td>'
      +'</tr>';
  }).join('');

  const html = '<!DOCTYPE html><html><head><title>'+q.qno+'</title><meta charset="UTF-8"><style>'
+'*{box-sizing:border-box;margin:0;padding:0}'
+'body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#2B2B2B;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
+'@media print{@page{size:A4;margin:10mm 12mm 18mm 12mm;@bottom-right{content:"Page " counter(page) " of " counter(pages);font-family:Arial,sans-serif;font-size:8pt;color:#5A6677;padding-top:4pt}}'
+'tfoot td{padding:0 !important}.page-wrap{box-shadow:none !important}}'
+'@media screen{body{background:#d0d0d0;padding:20px 0}.page-wrap{box-shadow:0 4px 20px rgba(0,0,0,.2)}}'
+'.page-wrap{width:210mm;margin:0 auto;background:#fff;border-collapse:collapse;table-layout:fixed}'
+'.page-wrap>thead>tr>td,.page-wrap>tfoot>tr>td{padding:0}'
+'.page-wrap>tbody>tr>td{padding:0;vertical-align:top}'
+'.hdr{background:#0B539D;padding:14px 12mm;border-bottom:4px solid #F15A25}'
+'.hdr-row{display:flex;justify-content:space-between;align-items:center}'
+'.logo-card{background:#fff;border-radius:5px;padding:6px 12px;display:inline-flex;align-items:center;box-shadow:0 2px 5px rgba(0,0,0,.2)}'
+'.co-meta{font-size:9px;color:#CFE2F4;line-height:1.8;margin-left:12px}'
+'.co-meta b{color:#fff;font-weight:700}'
+'.doc-right{text-align:right}'
+'.doc-label{font-size:13px;letter-spacing:2.4px;color:#fff;font-weight:800;background:#F15A25;display:inline-block;padding:4px 10px;border-radius:3px}'
+'.doc-num{font-size:15px;font-weight:800;color:#fff;margin-top:5px}'
+'.doc-sub{font-size:8.5px;color:#CFE2F4;margin-top:2px;white-space:nowrap}'
+'.meta{display:grid;grid-template-columns:1.3fr 1fr;border:1px solid #E2E8F0;margin:8px 12mm 10px}'
+'.mc{padding:10px 14px;border-right:1px solid #E2E8F0}'
+'.mc:last-child{border-right:none}'
+'.meta-ey{font-size:8px;letter-spacing:1.5px;color:#8B98A8;font-weight:700;margin-bottom:4px;text-transform:uppercase}'
+'.meta-nm{font-size:12px;font-weight:700;color:#0B539D}'
+'.meta-ln{font-size:10px;color:#5A6677;margin-top:2px}'
+'.mgrid{display:grid;grid-template-columns:1fr 1fr;gap:5px 10px}'
+'.mgrid div{font-size:10px}'
+'.mgrid b{display:block;font-size:8px;letter-spacing:.8px;color:#8B98A8;font-weight:700;text-transform:uppercase;margin-bottom:1px}'
+'.mgrid span{color:#0B539D;font-weight:600}'
+'.items-wrap{padding:0 12mm}'
+'.items-tbl{width:100%;border-collapse:collapse}'
+'.items-tbl thead th{background:#0B539D;color:#fff;font-size:9px;letter-spacing:.6px;font-weight:700;text-transform:uppercase;padding:7px 8px;text-align:left}'
+'.items-tbl thead th.r{text-align:right}.items-tbl thead th.c{text-align:center}'
+'.items-tbl tbody tr td{padding:6px 8px;font-size:10.5px;border-bottom:1px solid #EEF1F4;vertical-align:top;color:#2B2B2B}'
+'.items-tbl tbody tr:nth-child(even) td{background:#F6F8FA}'
+'.items-tbl thead{display:table-header-group}.items-tbl tr{page-break-inside:avoid;break-inside:avoid}.items-tbl tbody td,.items-tbl tbody td *{color:#000!important;font-weight:400!important}'
+'td.r{text-align:right;font-variant-numeric:tabular-nums}td.c{text-align:center}'
+'td.num{text-align:center;color:#8B98A8;font-size:9.5px;width:26px}'
+'.dsub{font-size:9px;color:#8B98A8;margin-top:1px}'
+'.tot-wrap{display:flex;justify-content:flex-end;margin:10px 12mm 0}'
+'.tot{width:250px;border:1px solid #E2E8F0;overflow:hidden}'
+'.tot-row{display:flex;justify-content:space-between;padding:5px 12px;font-size:10.5px;border-bottom:1px solid #EEF1F4}'
+'.tot-row span:first-child{color:#5A6677}'
+'.tot-row span:last-child{font-weight:600;font-variant-numeric:tabular-nums}'
+'.tot-net{background:#0B539D;color:#fff;padding:9px 12px;display:flex;justify-content:space-between;align-items:center}'
+'.tot-net .lbl{font-size:8.5px;letter-spacing:1px;text-transform:uppercase;color:#BFDCF2;font-weight:700}'
+'.tot-net .val{font-size:14px;font-weight:800;color:#fff;font-variant-numeric:tabular-nums}'
+'.terms{margin:10px 12mm 0;padding:9px 13px;background:#F6F8FA;border-left:3px solid #F15A25}'
+'.terms-ttl{font-size:8px;letter-spacing:1.4px;color:#0B539D;font-weight:700;text-transform:uppercase;margin-bottom:5px}'
+'.terms ul{padding-left:14px;color:#5A6677}'
+'.terms li{font-size:10px;margin-bottom:2px;line-height:1.5}'
+'.note-box{margin:8px 12mm 0;padding:7px 12px;background:#FFFBEA;border:1px solid #F0D77B;font-size:10px;color:#5A4A0A}'
+'.sig{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin:15mm 12mm 8px}'
+'.sig-line{border-top:1px solid #2B2B2B;padding-top:5px;font-size:8.5px;color:#8B98A8}'
+'.closing-msg{margin:8px 12mm 10px;text-align:center;font-size:10px;line-height:1.5;color:#5A6677;font-style:italic}'
+'.closing-msg span{font-size:9.5px;color:#6B7280}'
+'.no-break{page-break-inside:avoid;break-inside:avoid}'
+'.footer-cell{border-top:1.5px solid #0B539D;padding:6px 12mm 5px !important;background:#fff}'
+'.footer-inner{display:flex;justify-content:space-between;align-items:center}'
+'.footer-addr{font-size:10.5px;color:#3F4A5A;line-height:1.65;font-weight:500}'
+'</style></head><body>'
+'<table class="page-wrap">'
+'<tfoot><tr><td><div class="footer-cell"><div class="footer-inner"><div class="footer-addr">'
+footerLine1+'<br>'+footerLine2
+'</div></div></div></td></tr></tfoot>'
+'<tbody><tr><td>'
+'<div class="hdr"><div class="hdr-row">'
+'<div style="display:flex;align-items:center">'
+(settings.logo ? '<div class="logo-card">'+logoHtml+'</div>' : '')
+'<div class="co-meta">'
+(!settings.logo ? '<b style="font-size:13px">'+co+'</b><br>' : '')
+headerInfo
+'</div></div>'
+'<div class="doc-right">'
+'<span class="doc-label">QUOTATION</span>'
+'<div class="doc-num">'+q.qno+'</div>'
+(q.ref ? '<div class="doc-sub">Client Ref: '+q.ref+'</div>' : '')
+'<div class="doc-sub">Issued: '+fmtDate(q.date)+'</div>'
+'<div class="doc-sub">Valid until: '+fmtDate(vu)+'</div>'
+'</div></div></div>'
+'<div class="meta">'
+'<div class="mc"><div class="meta-ey">Customer</div>'
+'<div class="meta-nm">'+q.company+'</div>'
+(q.contact ? '<div class="meta-ln">Attention: '+q.contact+'</div>' : '')
+(q.project ? '<div class="meta-ln">Project: '+q.project+'</div>' : '')
+(q.city    ? '<div class="meta-ln">'+q.city+'</div>' : '')
+'</div>'
+'<div class="mc"><div class="mgrid">'
+'<div><b>Validity</b><span>'+(q.validity||7)+' days</span></div>'
+'<div><b>Delivery</b><span>'+(q.delivery||'\u2014')+'</span></div>'
+'<div><b>Payment</b><span>'+(q.payment||'\u2014')+'</span></div>'
+'<div><b>Currency</b><span>SAR</span></div>'
+'</div></div></div>'
+'<div class="items-wrap"><table class="items-tbl">'
+'<thead><tr>'
+'<th style="width:26px">#</th><th>Description</th>'
+'<th class="r" style="width:44px">Qty</th>'
+'<th class="c" style="width:46px">UOM</th>'
+'<th class="r" style="width:84px">Unit Price</th>'
+'<th class="r" style="width:88px">Amount</th>'
+'</tr></thead><tbody>'+itemRows+'</tbody></table></div>'
+'<div class="tot-wrap no-break"><div class="tot">'
+'<div class="tot-row"><span>Sub-total</span><span>'+fmt(sub)+'</span></div>'
+(disc>0 ? '<div class="tot-row"><span>Discount</span><span>\u2212 '+fmt(disc)+'</span></div><div class="tot-row"><span>Total before VAT</span><span>'+fmt(bvat)+'</span></div>' : '')
+'<div class="tot-row" style="border-bottom:none"><span>VAT ('+(settings.vatrate||15)+'%)</span><span>'+fmt(vat)+'</span></div>'
+'<div class="tot-net"><span class="lbl">Net Amount</span><span class="val">'+fmt(net)+'</span></div>'
+'</div></div>'
+'<div class="terms no-break"><div class="terms-ttl">Terms &amp; Conditions</div><ul>'
+'<li>This quotation is valid for '+(q.validity||7)+' days from the date of issue.</li>'
+'<li>Delivery terms: '+(q.delivery||'\u2014')+'</li>'
+'<li>Payment terms: '+(q.payment||'\u2014')+'</li>'
+'<li>Stock is subject to availability at the time of order confirmation.</li>'
+'</ul></div>'
+(q.notes ? '<div class="note-box no-break"><strong>Notes:</strong> '+q.notes+'</div>' : '')
+'<div class="sig no-break">'
+'<div class="sig-line">CUSTOMER ACCEPTANCE &amp; SIGNATURE</div>'
+'<div class="sig-line">AUTHORISED SIGNATURE \u2014 '+co.toUpperCase()+'</div>'
+'</div>'
+'<div class="closing-msg no-break">Thank you for the opportunity to quote. We look forward to serving you.<br><span>If you have any questions regarding this quotation, please feel free to contact us.</span></div>'
+'</td></tr></tbody></table>'
+'<scr'+'ipt>window.onload=function(){setTimeout(function(){window.print()},600)}<'+'/script>'
+'</body></html>';

  const w = window.open('', '_blank', 'width=880,height=1020');
  w.document.write(html);
  w.document.close();
}

/* ── CUSTOMER CRUD ── */
function addContactRow(contact={}) {
  const list = document.getElementById('cm-contacts-list');
  const isFirst = list.children.length === 0;
  const div = document.createElement('div');
  div.className = 'contact-row' + (isFirst ? ' default-contact' : '');
  div.innerHTML = `
    <div>
      <div style="font-size:10px;color:var(--gray);margin-bottom:3px">Full name</div>
      <input placeholder="e.g. Mr. Ahmed Al-Rashidi" value="${contact.name||''}">
    </div>
    <div>
      <div style="font-size:10px;color:var(--gray);margin-bottom:3px">Position / Title</div>
      <input placeholder="e.g. Procurement Manager" value="${contact.title||''}">
    </div>
    <div>
      <div style="font-size:10px;color:var(--gray);margin-bottom:3px">Phone / Email</div>
      <input placeholder="+966 XX XXX XXXX or email" value="${contact.phone||''}">
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
      ${isFirst ? '<span class="default-badge">Default</span>' : '<button onclick="setDefaultContact(this)" style="font-size:10px;background:none;border:1px solid var(--border);border-radius:4px;padding:3px 6px;cursor:pointer;color:var(--gray)">Set default</button>'}
      <button onclick="this.closest('.contact-row').remove()" style="background:none;border:none;cursor:pointer;color:var(--red);font-size:14px;padding:2px"><i class="ti ti-trash"></i></button>
    </div>`;
  list.appendChild(div);
}

function setDefaultContact(btn) {
  const list = document.getElementById('cm-contacts-list');
  list.querySelectorAll('.contact-row').forEach(row => {
    row.classList.remove('default-contact');
    const actionDiv = row.querySelector('div:last-child');
    const spans = actionDiv.querySelectorAll('.default-badge');
    spans.forEach(s => {
      const newBtn = document.createElement('button');
      newBtn.setAttribute('onclick','setDefaultContact(this)');
      newBtn.style.cssText = 'font-size:10px;background:none;border:1px solid var(--border);border-radius:4px;padding:3px 6px;cursor:pointer;color:var(--gray)';
      newBtn.textContent = 'Set default';
      s.replaceWith(newBtn);
    });
  });
  const row = btn.closest('.contact-row');
  row.classList.add('default-contact');
  const span = document.createElement('span');
  span.className = 'default-badge';
  span.textContent = 'Default';
  btn.replaceWith(span);
}

function openAddCustomer() {
  editingCustId = null;
  const delBtn=document.getElementById('cust-edit-delete-btn'); if(delBtn){delBtn.style.display='none';delBtn.removeAttribute('data-cid');}
  document.getElementById('cust-modal-title').textContent = 'Add customer';
  resetCustomerPartyFields('');
  document.getElementById('cm-contacts-list').innerHTML = '';
  addContactRow();
  openModalWithSize('cust-modal');
}

function profileTxnDate(v){
  if(!v) return '';
  const d=new Date(v);
  return isNaN(d)?String(v):d.toISOString();
}
function toggleProfileTransactions(btn){
  const section=btn.closest('.profile-recent'); if(!section)return;
  section.classList.toggle('open');
  btn.setAttribute('aria-expanded', section.classList.contains('open')?'true':'false');
}
function filterProfileTransactions(sel){
  const section=sel.closest('.profile-recent'); if(!section)return;
  const type=sel.value;
  section.querySelectorAll('tbody tr[data-txn-type]').forEach(tr=>tr.style.display=(!type||tr.dataset.txnType===type)?'':'none');
}
function viewCustomer(id) {
  const c = customers.find(x=>x.id===id); if (!c) return;
  const cname=normalizeMasterValue(c.company);
  const contacts = c.contacts || (c.contact ? [{name:c.contact,title:'',phone:c.phone||'',isDefault:true}] : []);
  const cQuotes = quotations.filter(q=>recordBelongsToCustomer(q,c,'company'));
  const cRFQs = rfqs.filter(r=>recordBelongsToCustomer(r,c,'company'));
  const cSOs = salesOrders.filter(o=>recordBelongsToCustomer(o,c,'customer'));
  const totalVal = cQuotes.reduce((sum,q)=>sum+calcQuote(q).net,0);
  const wonVal = cQuotes.filter(q=>q.status==='Won').reduce((sum,q)=>sum+calcQuote(q).net,0);
  const totalRefs=cQuotes.length+cRFQs.length+cSOs.length;
  const addr=partyAddressSummary(c);
  const contactsHtml=contacts.length?contacts.map(ct=>`<div class="profile-contact-row"><div><strong>${ct.name||'—'}</strong>${ct.isDefault?'<span class="profile-default-chip">Default</span>':''}<span>${ct.title||''}</span></div><small>${ct.phone||''}</small></div>`).join(''):'<div class="product-profile-empty">No contacts have been added.</div>';
  const txns=[];
  cRFQs.forEach(r=>txns.push({type:'RFQ',date:r.date||r.created||'',no:r.rfqNo||'RFQ',status:r.status||'—',amount:null,open:`closeModal('cust-view-modal');viewRFQ('${r.id}')`}));
  cQuotes.forEach(q=>txns.push({type:'Quotation',date:q.date||q.created||'',no:q.qno||'Quotation',status:q.status||'—',amount:calcQuote(q).net,open:`closeModal('cust-view-modal');viewQuotation('${q.id}')`}));
  cSOs.forEach(o=>txns.push({type:'Sales Order',date:o.date||o.created||'',no:o.soNo||'Sales Order',status:o.status||o._status||'—',amount:Number(o.total)||0,open:`closeModal('cust-view-modal');viewSO('${o.id}')`}));
  txns.sort((a,b)=>profileTxnDate(b.date).localeCompare(profileTxnDate(a.date)));
  const txnRows=txns.slice(0,10).map(t=>`<tr data-txn-type="${t.type}"><td>${fmtDate(t.date)||'—'}</td><td><button class="profile-doc-link" onclick="${t.open}">${t.no}</button></td><td>${t.type}</td><td><span class="badge ${t.type==='Sales Order'?getSOBadgeClass(t.status):getStatusClass(t.status)}">${t.status}</span></td><td class="right">${t.amount==null?'—':fmtShort(t.amount)}</td></tr>`).join('')||'<tr><td colspan="5" class="profile-no-txns">No transactions found for this customer.</td></tr>';
  document.getElementById('cust-view-body').innerHTML=`<div class="product-profile business-profile">
    <div class="product-profile-hero"><div class="product-profile-identity"><div class="product-profile-icon"><i class="ti ti-building"></i></div><div><div class="product-profile-eyebrow">CUSTOMER PROFILE</div><h3>${c.company}</h3>${c.companyAr?`<div class="profile-arabic-name" dir="rtl">${esc(c.companyAr)}</div>`:''}<div class="product-profile-meta">${c.city?`<span>${c.city}</span>`:''}${c.vat?`<span>VAT ${c.vat}</span>`:''}</div></div></div><span class="product-profile-status"><i class="ti ti-circle-check-filled"></i> Active</span></div>
    <div class="product-profile-grid product-profile-lower-grid">
      <section class="product-profile-card"><div class="product-profile-section-title"><i class="ti ti-building"></i><span>Customer information</span></div><div class="product-profile-fields"><div><label>Company</label><strong>${c.company}</strong></div><div><label>VAT number</label><span>${c.vat||'—'}</span></div><div><label>Mobile</label><span>${c.mobile||'—'}</span></div><div><label>Email</label><span>${c.email||'—'}</span></div><div><label>Total references</label><strong>${totalRefs}</strong></div></div></section>
      <section class="product-profile-card"><div class="product-profile-section-title"><i class="ti ti-address-book"></i><span>Contacts</span></div><div class="profile-contacts">${contactsHtml}</div></section>
    </div>
    <section class="product-profile-card party-address-card"><div class="product-profile-section-title"><i class="ti ti-map-pin"></i><span>National address</span></div><div class="party-address-layout"><div class="party-address-readable"><strong>${c.shortAddress||'National address'}</strong><span>${addr.line1||'—'}</span><span>${addr.line2||''}</span><span>${addr.country}</span>${(addr.ar1||addr.ar2||c.companyAr)?`<div class="party-address-ar" dir="rtl"><span>${addr.ar1||''}</span><span>${addr.ar2||''}</span><span>${addr.country==='Saudi Arabia'?'المملكة العربية السعودية':''}</span></div>`:''}</div><div class="party-address-facts"><div><label>Building No.</label><strong>${c.buildingNo||'—'}</strong></div><div><label>Secondary No.</label><strong>${c.secondaryNo||'—'}</strong></div><div><label>Postal Code</label><strong>${c.postalCode||'—'}</strong></div><div><label>City</label><strong>${c.city||'—'}</strong></div></div></div></section>
    <section class="product-profile-card product-profile-usage-card"><div class="product-profile-section-title"><i class="ti ti-chart-dots-3"></i><span>Activity & usage</span></div><div class="product-profile-usage"><div><span>RFQs</span><strong>${cRFQs.length}</strong></div><div><span>Quotations</span><strong>${cQuotes.length}</strong></div><div><span>Sales orders</span><strong>${cSOs.length}</strong></div><div class="product-profile-usage-total"><span>Quotation value</span><strong>${fmtShort(totalVal)}</strong></div></div><div class="product-profile-usage-note"><i class="ti ti-trophy"></i>Won quotation value: <strong>${fmtShort(wonVal)}</strong></div></section>
    <section class="product-profile-card profile-recent"><button class="profile-recent-head" onclick="toggleProfileTransactions(this)" aria-expanded="false"><span><i class="ti ti-history"></i> Recent transactions</span><span class="profile-recent-hint">Latest ${Math.min(txns.length,10)} <i class="ti ti-chevron-down"></i></span></button><div class="profile-recent-body"><div class="profile-recent-tools"><span>Showing latest transactions</span><select onchange="filterProfileTransactions(this)"><option value="">All types</option><option>RFQ</option><option>Quotation</option><option>Sales Order</option></select></div><div class="table-wrap"><table class="profile-txn-table"><thead><tr><th>Date</th><th>Document</th><th>Type</th><th>Status</th><th class="right">Amount</th></tr></thead><tbody>${txnRows}</tbody></table></div></div></section>
  </div>`;
  document.getElementById('cust-view-title').textContent='Customer details';
  document.getElementById('cust-view-edit-btn').setAttribute('data-cid',id); document.getElementById('cust-view-delete-btn')?.setAttribute('data-cid',id);
  openModalWithSize('cust-view-modal');
}

function openEditCustomer(id) {
  const c = customers.find(x=>x.id===id); if (!c) return;
  editingCustId = id;
  const delBtn=document.getElementById('cust-edit-delete-btn'); if(delBtn){delBtn.style.display='inline-flex';delBtn.setAttribute('data-cid',id);}
  document.getElementById('cust-modal-title').textContent = 'Edit — ' + c.company;
  setPartyField('cm-company',c.company||''); setPartyField('cm-company-ar',c.companyAr||''); setPartyField('cm-vat',c.vat||'');
  setPartyField('cm-mobile',c.mobile||''); setPartyField('cm-email',c.email||''); setPartyField('cm-short-address',c.shortAddress||''); setPartyField('cm-building-no',c.buildingNo||'');
  setPartyField('cm-street',c.street||''); setPartyField('cm-street-ar',c.streetAr||''); setPartyField('cm-secondary-no',c.secondaryNo||''); setPartyField('cm-postal-code',c.postalCode||'');
  setPartyField('cm-district',c.district||''); setPartyField('cm-district-ar',c.districtAr||''); setPartyField('cm-city',c.city||''); setPartyField('cm-city-ar',c.cityAr||''); setPartyField('cm-country',c.country||'Saudi Arabia');
  document.getElementById('cm-contacts-list').innerHTML = '';
  const contacts = c.contacts || (c.contact ? [{name:c.contact,title:'',phone:c.phone||'',isDefault:true}] : []);
  if (contacts.length) contacts.forEach(ct => addContactRow(ct));
  else addContactRow();
  openModalWithSize('cust-modal');
}

/* saveCustomer defined below with quick-add support */

async function deleteCustomer(id, sourceModalId='') {
  return requestMasterDelete('customers', [id], sourceModalId);
}

function closeModal(id) {
  const overlay = document.getElementById(id);
  if(overlay?.classList.contains('open') && !modalNavExcluded.has(id)){lastClosedModal=id;lastClosedModalAt=Date.now();}
  overlay?.classList.remove('open','modal-fs-overlay');
  updateFullscreenShellState();
  _dirtyModal = null;
}

/* ── UNSAVED CHANGES GUARD ── */
let _dirtyModal = null; // tracks which modal has unsaved changes

function setRFQFormState(state='saved') {
  const el=document.getElementById('rfq-form-state');
  const btn=document.getElementById('rfq-save-btn');
  if(!el) return;
  el.className='rfq-form-status '+state;
  el.textContent=state==='unsaved'?'Unsaved changes':state==='saved'?'Saved':'Ready';
  if(btn) btn.classList.toggle('rfq-save-active',state==='unsaved');
}
function markDirty(modalId) {
  _dirtyModal = modalId;
  if(modalId==='rfq-modal') setRFQFormState('unsaved');
  if(modalId==='quote-modal') setQuoteFormState('unsaved');
}
function clearDirty() {
  if(_dirtyModal==='rfq-modal') setRFQFormState('saved');
  if(_dirtyModal==='quote-modal') setQuoteFormState('saved');
  _dirtyModal = null;
}

// Call this instead of closeModal() on X and Cancel buttons of EDIT modals
async function confirmCloseModal(id) {
  if (_dirtyModal === id) {
    const confirmed = await new Promise(resolve => {
      showConfirm({
        icon: '⚠️',
        title: 'Discard unsaved changes?',
        message: 'You have unsaved changes in this form. If you close now, your changes will be lost.',
        details: {},
        confirmText: '✕ Discard and close',
        cancelText: '← Keep editing',
        confirmClass: 'btn-danger',
        onConfirm: () => resolve(true),
        onCancel:  () => resolve(false),
      });
    });
    if (!confirmed) return;
  }
  closeModal(id);
}

function navigateToSO(soId) {
  // Find and activate the Sales Orders nav item
  const navItems = document.querySelectorAll('.nav-item');
  let soNavItem = null;
  navItems.forEach(n => { if (n.textContent.includes('Sales Orders')) soNavItem = n; });
  showPage('salesorders', soNavItem);
  // Open the SO view after a short delay for the page to render
  setTimeout(() => viewSO(soId), 80);
}

/* ── v109: Global BizCore Screen Transition Manager ──
   One reusable transition infrastructure for current and future screens.
   Important rule: the overlay is operation-driven, never dismissed by an
   elapsed-time timer.  It remains until the async action and destination
   readiness check have both completed (or the action throws). */
let _screenTransitionTimer=null;
let _screenTransitionDepth=0;
function beginScreenTransition(message,{immediate=false}={}){
  // Nested operations share the same blocking overlay rather than flashing it.
  _screenTransitionDepth++;
  const existing=document.getElementById('bizcore-screen-transition');
  if(existing){
    const title=existing.querySelector('.screen-transition-title');
    if(title && message) title.textContent=message;
    return;
  }
  const mount=()=>{
    _screenTransitionTimer=null;
    if(document.getElementById('bizcore-screen-transition')) return;
    const overlay=document.createElement('div');
    overlay.id='bizcore-screen-transition';
    overlay.className='bizcore-screen-transition';
    overlay.setAttribute('role','status');
    overlay.setAttribute('aria-live','polite');
    overlay.setAttribute('aria-busy','true');
    overlay.innerHTML=`<div class="screen-transition-card">
      <div class="screen-transition-title">${escapeHtml(message||'Preparing document…')}</div>
      <div class="screen-transition-subtitle">Please wait</div>
      <div class="screen-transition-track" aria-hidden="true"><span></span></div>
    </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(()=>overlay.classList.add('show'));
  };
  // The delay only decides whether a very fast operation needs an overlay.
  // It NEVER controls when an already-visible overlay is removed.
  if(immediate) mount(); else _screenTransitionTimer=setTimeout(mount,280);
}
function endScreenTransition({immediate=false,force=false}={}){
  if(force) _screenTransitionDepth=0;
  else _screenTransitionDepth=Math.max(0,_screenTransitionDepth-1);
  if(_screenTransitionDepth>0) return;
  if(_screenTransitionTimer){clearTimeout(_screenTransitionTimer);_screenTransitionTimer=null;}
  const overlay=document.getElementById('bizcore-screen-transition');
  if(!overlay) return;
  if(immediate){overlay.remove();return;}
  overlay.classList.remove('show');
  // This 140ms is CSS fade cleanup only, after the operation is complete.
  setTimeout(()=>overlay.remove(),140);
}
function waitForUiCondition(test){
  // No completion timeout: slow network/rendering keeps the screen blocked.
  return new Promise(resolve=>{
    const check=()=>{
      let ready=false;
      try{ready=!!test();}catch(e){}
      if(ready){requestAnimationFrame(()=>requestAnimationFrame(resolve));return;}
      requestAnimationFrame(check);
    };
    check();
  });
}
function isModalOpen(id){return !!document.getElementById(id)?.classList.contains('open');}
async function runScreenTransition({message='Preparing document…',immediate=false,action,ready,sourceModal='',closeSource=false,errorMessage='Could not complete this operation. Please try again.',endImmediate=false}={}){
  beginScreenTransition(message,{immediate});
  try{
    const result=await action?.();
    if(ready) await waitForUiCondition(()=>ready(result));
    if(closeSource && sourceModal && isModalOpen(sourceModal)) closeModal(sourceModal);
    // Paint the destination underneath the still-blocking overlay before release.
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return result;
  }catch(err){
    console.error(err);
    if(errorMessage) showToast(errorMessage,'error');
    throw err;
  }finally{
    endScreenTransition({immediate:endImmediate});
  }
}
const BizCoreTransition={run:runScreenTransition,begin:beginScreenTransition,end:endScreenTransition,waitFor:waitForUiCondition,isModalOpen};
window.BizCoreTransition=BizCoreTransition;

async function closeEntryWithTransition(modalId,label='document'){
  // Cancel/close is immediate and remains blocked until the source form is
  // genuinely closed and the destination has painted. There is no close timer.
  try{
    await runScreenTransition({
      message:`Closing ${label}…`, immediate:true, endImmediate:true,
      action:async()=>{
        await new Promise(resolve=>requestAnimationFrame(resolve));
        if(typeof window.bizcorePerformClose==='function') window.bizcorePerformClose(modalId,true);
        else closeModal(modalId);
      },
      ready:()=>!isModalOpen(modalId),
      errorMessage:`Could not close the ${label}. Please try again.`
    });
  }catch(e){}
}
window.closeEntryWithTransition=closeEntryWithTransition;
async function transitionToRFQEdit(btn){
  const id=btn?.getAttribute('data-rid'); if(!id) return;
  btn.disabled=true;
  try{
    await runScreenTransition({
      message:'Preparing RFQ for editing…',
      action:()=>editRFQ(id), ready:()=>isModalOpen('rfq-modal'),
      sourceModal:'rfq-view-modal', closeSource:true,
      errorMessage:'Could not open the RFQ for editing. Please try again.'
    });
  }catch(e){} finally{btn.disabled=false;}
}
async function transitionToQuotationEdit(btn){
  const id=btn?.getAttribute('data-qid'); if(!id) return;
  btn.disabled=true;
  try{
    await runScreenTransition({
      message:'Preparing quotation for editing…',
      action:()=>editQuotation(id), ready:()=>isModalOpen('quote-modal'),
      sourceModal:'view-modal', closeSource:true,
      errorMessage:'Could not open the quotation for editing. Please try again.'
    });
  }catch(e){} finally{btn.disabled=false;}
}
async function transitionRFQToPricing(btn){
  const id=btn?.getAttribute('data-rid'); if(!id) return;
  btn.disabled=true;
  try{
    await runScreenTransition({
      message:'Preparing pricing…',
      action:()=>openPricingSheet(id,{closeSource:false}),
      ready:()=>isModalOpen('pricing-modal') || isModalOpen('pricing-ro-modal'),
      sourceModal:'rfq-view-modal', closeSource:true,
      errorMessage:'Could not open pricing. Please try again.'
    });
  }catch(e){} finally{btn.disabled=false;}
}
async function transitionQuotationToSO(btnOrId){
  const id=typeof btnOrId==='string'?btnOrId:btnOrId?.getAttribute('data-qid');if(!id)return;
  if(typeof btnOrId!=='string'&&btnOrId)btnOrId.disabled=true;
  try{await runScreenTransition({message:'Preparing sales order…',action:()=>openCreateSO(id),ready:()=>isModalOpen('so-create-modal'),sourceModal:'view-modal',closeSource:true,errorMessage:'Could not prepare the Sales Order. Please try again.'});}catch(e){}finally{if(typeof btnOrId!=='string'&&btnOrId)btnOrId.disabled=false;}
}
/* ── BACK NAVIGATION WRAPPERS ── */
function backToQuoteFromRFQ() {
  const qid = navFromQuoteId; navFromQuoteId = null;
  closeModal('rfq-view-modal');
  if (qid) viewQuotation(qid);
}
function closeRFQView()       { closeModal('rfq-view-modal'); }
function editRFQFromView(btn) { transitionToRFQEdit(btn); }
function viewQuoteFromRFQ(btn){ const id=btn.getAttribute('data-qid'); closeModal('rfq-view-modal'); if(id) viewQuotation(id); }
function viewPricingROFromBtn(btn) { const id=btn.getAttribute('data-rid'); if(id) viewPricingReadOnly(id); }
function openPricingFromBtn(btn)   { transitionRFQToPricing(btn); }
function openNoBidDialogFromBtn(btn) { const id=btn.getAttribute('data-rid'); if(id) openNoBidDialog(id); }
function deleteRFQFromBtn(btn) { const id=btn.getAttribute('data-rid'); if(id) deleteRFQRecord(id); }
function reopenRFQFromBtn(btn) { const id=btn.getAttribute('data-rid'); if(id) reopenRFQ(id); }

function openNoBidDialog(id) {
  const r=rfqs.find(x=>x.id===id); if(!r) return;
  document.getElementById('rfq-no-bid-overlay')?.remove();
  const ov=document.createElement('div'); ov.id='rfq-no-bid-overlay'; ov.className='no-bid-overlay';
  ov.innerHTML=`<div class="no-bid-dialog"><div class="no-bid-head"><div class="no-bid-icon"><i class="ti ti-circle-off"></i></div><div><h3>Close RFQ as No Bid</h3><p>${r.rfqNo} · ${r.company}</p></div></div><div class="no-bid-body"><label>Reason</label><select id="rfq-no-bid-reason"><option value="">Select a reason</option><option>Customer cancelled the request</option><option>Unable to source the requested items</option><option>Outside our business scope</option><option>Insufficient time to prepare an offer</option><option>Commercial decision</option><option>Duplicate RFQ</option><option>Other</option></select><label style="margin-top:12px">Internal note <span style="font-weight:400;color:#94a3b8">(optional)</span></label><textarea id="rfq-no-bid-note" placeholder="Add a short explanation for future reference"></textarea></div><div class="no-bid-foot"><button class="btn btn-secondary" onclick="document.getElementById('rfq-no-bid-overlay').remove()">Cancel</button><button class="btn btn-primary" data-rid="${id}" onclick="confirmNoBid(this)"><i class="ti ti-check"></i>Close as No Bid</button></div></div>`;
  document.body.appendChild(ov);
}
async function confirmNoBid(btn) {
  const id=btn.getAttribute('data-rid'), reason=document.getElementById('rfq-no-bid-reason').value, note=document.getElementById('rfq-no-bid-note').value.trim();
  if(!reason){showValidationDialog('Reason required','Select why this RFQ will not be quoted.','rfq-no-bid-reason','Select a reason');return;}
  const r=rfqs.find(x=>x.id===id); if(!r)return;
  r.status='No Bid'; r.noBidReason=reason; r.noBidNote=note; r.closedDate=new Date().toISOString();
  await saveRFQs(); document.getElementById('rfq-no-bid-overlay')?.remove(); renderRFQPage(); viewRFQ(id); showToast('RFQ closed as No Bid','success');
}
async function reopenRFQ(id) {
  const r=rfqs.find(x=>x.id===id); if(!r)return;
  r.status=(r.pricingItems&&r.pricingItems.length)?'Pricing':'New'; r.noBidReason=''; r.noBidNote=''; r.closedDate=null;
  await saveRFQs(); renderRFQPage(); viewRFQ(id); showToast('RFQ reopened','success');
}
function deleteRFQRecord(id) {
  const r=rfqs.find(x=>x.id===id); if(!r)return;
  if((r.pricingItems&&r.pricingItems.length)||r.quotationId){showValidationDialog('RFQ cannot be deleted','This RFQ already has pricing or a quotation. Close it as No Bid instead.');return;}
  showConfirm({icon:'🗑️',title:'Delete RFQ permanently?',message:'Use Delete only for an RFQ entered by mistake. This action cannot be undone.',details:{'RFQ':r.rfqNo,'Customer':r.company},confirmText:'Delete RFQ',confirmClass:'btn-danger',onConfirm:async()=>{rfqs=rfqs.filter(x=>x.id!==id);await saveRFQs();closeModal('rfq-view-modal');renderRFQPage();showToast('RFQ deleted','success');}});
}

function backToQuoteFromPricing() {
  const qid = navFromQuoteId;
  closeModal('pricing-modal');
  if (qid) viewQuotation(qid);
}
function backToQuoteFromRO() {
  const qid = navFromQuoteId;
  closeModal('pricing-ro-modal');
  if (qid) viewQuotation(qid);
}
function backToRFQFromRO(btn) {
  const rid = btn.getAttribute('data-rid');
  closeModal('pricing-ro-modal');
  if (rid) viewRFQ(rid);
}
function revisePricingFromRO(btn) {
  const rid=btn.getAttribute('data-rid');
  if(!rid)return;
  const r=rfqs.find(x=>x.id===rid); if(!r)return;
  const current=getCurrentPricingVersion(r);
  if(!current || !['Converted','Superseded'].includes(current.status)){closeModal('pricing-ro-modal');openPricingSheet(rid);return;}
  const reason=(window.prompt('Revision reason (required):','')||'').trim();
  if(!reason){showToast('Enter a revision reason to continue','error');return;}
  const nextVersion=Math.max(0,...ensurePricingVersions(r).map(v=>Number(v.version)||0))+1;
  const revised={
    ...JSON.parse(JSON.stringify(current)), version:nextVersion, status:'Revision Draft', revisionReason:reason,
    previousVersion:Number(current.version)||1, quotationId:null, convertedDate:null,
    created:new Date().toISOString(), updated:new Date().toISOString()
  };
  r.pricingVersions.push(revised); r.currentPricingVersion=nextVersion; syncRFQFromPricingVersion(r,revised); r.status='Pricing';
  saveRFQs().then(()=>{closeModal('pricing-ro-modal');renderRFQPage();openPricingSheet(rid);showToast('Pricing V'+nextVersion+' created for revision','success');});
}
function editPricingFromRO(btn) {
  const rid = btn.getAttribute('data-rid');
  const r=rfqs.find(x=>x.id===rid);
  if(r && isPricingVersionLocked(r)){revisePricingFromRO(btn);return;}
  closeModal('pricing-ro-modal');
  if (rid) openPricingSheet(rid);
}

function viewPricingFromQuote(btn) {
  const rfqId  = btn.getAttribute('data-rfqid');
  // Track which quotation we came from so Back button works
  const vTitle = document.getElementById('view-title')?.textContent || '';
  const matchQ = quotations.find(q => vTitle.includes(q.qno));
  navFromQuoteId = matchQ?.id || null;
  closeModal('view-modal');
  // Open READ-ONLY pricing view (not editable)
  if (rfqId) viewPricingReadOnly(rfqId);
}

function viewRFQFromQuote(btn) {
  const rfqId  = btn.getAttribute('data-rfqid');
  const vTitle = document.getElementById('view-title')?.textContent || '';
  const matchQ = quotations.find(q => vTitle.includes(q.qno));
  navFromQuoteId = matchQ?.id || null;
  closeModal('view-modal');
  if (rfqId) viewRFQ(rfqId);
}

/* ══════════════════════════════════════════════════
   SUPPLIERS
══════════════════════════════════════════════════ */
async function saveSuppliers() {
  try { localStorage.setItem('dtq_suppliers', JSON.stringify(suppliers)); } catch(e) {}
  if (window.FB) await window.FB.fbSave('suppliers', suppliers);
}
async function saveRFQs() {
  try { localStorage.setItem('dtq_rfqs', JSON.stringify(rfqs)); } catch(e) {}
  if (window.FB) await window.FB.fbSave('rfqs', rfqs);
}

function renderSuppliers() {
  const search = (document.getElementById('sup-search')?.value||'').toLowerCase();
  const list = suppliers.filter(s => !search || `${s.company} ${s.contact} ${s.cat}`.toLowerCase().includes(search));
  const tbody = document.getElementById('suppliers-tbody');
  if (!tbody) return;
  const sortedList=sortRegisterRows(list,'suppliers',{company:x=>x.company,contact:x=>x.contact,phone:x=>x.phone,email:x=>x.email,category:x=>x.cat,city:x=>x.city,quotes:x=>rfqs.filter(r=>recordBelongsToSupplier(r,x)).length});
  const supplierPages=Math.ceil(sortedList.length/PER_PAGE)||1;
  if(supplierPage>supplierPages) supplierPage=1;
  const supplierSlice=sortedList.slice((supplierPage-1)*PER_PAGE,supplierPage*PER_PAGE);
  masterVisiblePageIds.suppliers = supplierSlice.map(s=>s.id);
  document.querySelectorAll('.rows-per-page-select').forEach(el=>{ if(el.value!=String(PER_PAGE)) el.value=String(PER_PAGE); });
  tbody.innerHTML = supplierSlice.length ? supplierSlice.map(s => {
    const selected = masterSelection.suppliers.has(s.id);
    const quoteCount = rfqs.filter(r => recordBelongsToSupplier(r,s)).length;
    return `<tr class="master-clickable-row${selected?' master-row-selected':''}" data-master-type="suppliers" data-master-id="${s.id}" tabindex="0" role="button" aria-label="Open supplier ${s.company}" onclick="viewSupplier('${s.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();viewSupplier('${s.id}');}">
      <td class="master-select-col" onclick="event.stopPropagation()"><input class="master-row-check" type="checkbox" ${selected?'checked':''} onkeydown="event.stopPropagation()" aria-label="Select ${s.company}" onchange="toggleMasterSelection('suppliers','${s.id}',this.checked)"></td>
      <td><strong>${s.company}</strong></td>
      <td>${s.contact||'—'}</td>
      <td>${s.phone||'—'}</td>
      <td>${s.email||'—'}</td>
      <td>${s.cat||'—'}</td>
      <td>${s.city||'—'}</td>
      <td class="center">${quoteCount}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="8"><div class="empty-state"><i class="ti ti-building-store"></i><p>No suppliers yet. Add your first supplier.</p></div></td></tr>`;
  const sp=document.getElementById('suppliers-pagination'); if(sp) sp.innerHTML=buildPaginationHTML(supplierPage,supplierPages,'goSupplierPage');
  updateMasterSelectionUI('suppliers');
}
function goSupplierPage(p){supplierPage=p;renderSuppliers();}

function openAddSupplier() {
  editingSupId = null;
  const delBtn=document.getElementById('sup-delete-btn'); if(delBtn){delBtn.style.display='none';delBtn.removeAttribute('data-sid');}
  document.getElementById('sup-modal-title').textContent = 'Add supplier';
  resetSupplierPartyFields('');
  openModalWithSize('sup-modal');
}
function viewSupplier(id) {
  const sp=suppliers.find(x=>x.id===id); if(!sp)return;
  const sname=normalizeMasterValue(sp.company);
  const related=rfqs.filter(r=>{
    if(recordBelongsToSupplier(r,sp))return true;
    return (r.pricingItems||[]).some(it=>supplierRefMatches(it,sp)) || (r.vendorQuotes||[]).some(v=>supplierRefMatches(v,sp)) || (r.pricingVersions||[]).some(v=>supplierRefMatches(v,sp) || (v.pricingItems||[]).some(it=>supplierRefMatches(it,sp)) || (v.vendorQuotes||[]).some(q=>supplierRefMatches(q,sp)));
  });
  const pricingDocs=[];
  related.forEach(r=>{
    const versions=(r.pricingVersions&&r.pricingVersions.length)?r.pricingVersions:[{version:r.currentPricingVersion||1,status:r.status,updated:r.updated,date:r.date,supplierName:r.supplierName}];
    versions.forEach(v=>{
      const used=supplierRefMatches(v,sp) || recordBelongsToSupplier(r,sp) || (v.pricingItems||r.pricingItems||[]).some(it=>supplierRefMatches(it,sp));
      if(used) pricingDocs.push({r,v});
    });
  });
  const txns=pricingDocs.map(({r,v})=>({type:'Pricing',date:v.updated||v.created||r.date||'',no:'PRC-'+String(r.rfqNo||r.id).replace(/[^A-Za-z0-9-]/g,'')+'-V'+(v.version||1),status:v.status||r.status||'—',open:`closeModal('sup-view-modal');viewPricingReadOnly('${r.id}')`}));
  txns.sort((a,b)=>profileTxnDate(b.date).localeCompare(profileTxnDate(a.date)));
  const addr=partyAddressSummary(sp);
  const txnRows=txns.slice(0,10).map(t=>`<tr data-txn-type="Pricing"><td>${fmtDate(t.date)||'—'}</td><td><button class="profile-doc-link" onclick="${t.open}">${t.no}</button></td><td>Pricing</td><td><span class="badge ${getStatusClass(t.status)}">${t.status}</span></td><td class="right">—</td></tr>`).join('')||'<tr><td colspan="5" class="profile-no-txns">No pricing transactions found for this supplier.</td></tr>';
  document.getElementById('sup-view-body').innerHTML=`<div class="product-profile business-profile">
    <div class="product-profile-hero"><div class="product-profile-identity"><div class="product-profile-icon"><i class="ti ti-building-store"></i></div><div><div class="product-profile-eyebrow">SUPPLIER PROFILE</div><h3>${sp.company}</h3>${sp.companyAr?`<div class="profile-arabic-name" dir="rtl">${esc(sp.companyAr)}</div>`:''}<div class="product-profile-meta">${sp.cat?`<span>${sp.cat}</span>`:''}${sp.city?`<span>${sp.city}</span>`:''}</div></div></div><span class="product-profile-status"><i class="ti ti-circle-check-filled"></i> Active</span></div>
    <div class="product-profile-grid product-profile-lower-grid"><section class="product-profile-card"><div class="product-profile-section-title"><i class="ti ti-building-store"></i><span>Supplier information</span></div><div class="product-profile-fields"><div><label>Company</label><strong>${sp.company}</strong></div><div><label>Category / specialty</label><span>${sp.cat||'—'}</span></div><div><label>VAT number</label><span>${sp.vat||'—'}</span></div><div><label>City</label><span>${sp.city||'—'}</span></div></div></section><section class="product-profile-card"><div class="product-profile-section-title"><i class="ti ti-address-book"></i><span>Contact information</span></div><div class="product-profile-fields"><div><label>Contact person</label><strong>${sp.contact||'—'}</strong>${sp.contactAr?`<small class="profile-inline-ar" dir="rtl">${esc(sp.contactAr)}</small>`:''}</div><div><label>Mobile</label><span>${sp.mobile||'—'}</span></div><div><label>Telephone</label><span>${sp.phone||'—'}</span></div><div><label>Email</label><span>${sp.email||'—'}</span></div><div><label>WhatsApp</label><span>${sp.whatsapp||'—'}</span></div></div></section></div>
    <section class="product-profile-card party-address-card"><div class="product-profile-section-title"><i class="ti ti-map-pin"></i><span>National address</span></div><div class="party-address-layout"><div class="party-address-readable"><strong>${sp.shortAddress||'National address'}</strong><span>${addr.line1||'—'}</span><span>${addr.line2||''}</span><span>${addr.country}</span>${(addr.ar1||addr.ar2||sp.companyAr)?`<div class="party-address-ar" dir="rtl"><span>${addr.ar1||''}</span><span>${addr.ar2||''}</span><span>${addr.country==='Saudi Arabia'?'المملكة العربية السعودية':''}</span></div>`:''}</div><div class="party-address-facts"><div><label>Building No.</label><strong>${sp.buildingNo||'—'}</strong></div><div><label>Secondary No.</label><strong>${sp.secondaryNo||'—'}</strong></div><div><label>Postal Code</label><strong>${sp.postalCode||'—'}</strong></div><div><label>City</label><strong>${sp.city||'—'}</strong></div></div></div></section>
    <div class="product-profile-grid product-profile-lower-grid"><section class="product-profile-card"><div class="product-profile-section-title"><i class="ti ti-chart-dots-3"></i><span>Activity & usage</span></div><div class="profile-compact-stats"><div><span>RFQ / Pricing references</span><strong>${related.length}</strong></div><div><span>Pricing documents</span><strong>${pricingDocs.length}</strong></div></div><div class="product-profile-usage-note"><i class="ti ti-shield-lock"></i>${related.length?'This supplier is connected to business records and is protected from deletion.':'No business-document references found.'}</div></section><section class="product-profile-card"><div class="product-profile-section-title"><i class="ti ti-note"></i><span>Notes</span></div><div class="product-profile-notes">${sp.notes||'<span>No notes have been added for this supplier.</span>'}</div></section></div>
    <section class="product-profile-card profile-recent"><button class="profile-recent-head" onclick="toggleProfileTransactions(this)" aria-expanded="false"><span><i class="ti ti-history"></i> Recent transactions</span><span class="profile-recent-hint">Latest ${Math.min(txns.length,10)} <i class="ti ti-chevron-down"></i></span></button><div class="profile-recent-body"><div class="profile-recent-tools"><span>Showing latest supplier transactions</span><select onchange="filterProfileTransactions(this)"><option value="">All types</option><option>Pricing</option></select></div><div class="table-wrap"><table class="profile-txn-table"><thead><tr><th>Date</th><th>Document</th><th>Type</th><th>Status</th><th class="right">Amount</th></tr></thead><tbody>${txnRows}</tbody></table></div></div></section>
  </div>`;
  document.getElementById('sup-view-title').textContent='Supplier details'; document.getElementById('sup-view-edit-btn').setAttribute('data-sid',id); document.getElementById('sup-view-delete-btn').setAttribute('data-sid',id); openModalWithSize('sup-view-modal');
}

function openEditSupplier(id) {
  const s = suppliers.find(x=>x.id===id); if (!s) return;
  editingSupId = id;
  const delBtn=document.getElementById('sup-delete-btn'); if(delBtn){delBtn.style.display='inline-flex';delBtn.setAttribute('data-sid',id);}
  document.getElementById('sup-modal-title').textContent = 'Edit — '+s.company;
  setPartyField('sm-company',s.company||''); setPartyField('sm-company-ar',s.companyAr||''); setPartyField('sm-contact',s.contact||''); setPartyField('sm-contact-ar',s.contactAr||'');
  setPartyField('sm-mobile',s.mobile||''); setPartyField('sm-phone',s.phone||''); setPartyField('sm-email',s.email||''); setPartyField('sm-whatsapp',s.whatsapp||''); setPartyField('sm-cat',s.cat||''); setPartyField('sm-vat',s.vat||'');
  setPartyField('sm-short-address',s.shortAddress||''); setPartyField('sm-building-no',s.buildingNo||''); setPartyField('sm-street',s.street||''); setPartyField('sm-street-ar',s.streetAr||''); setPartyField('sm-secondary-no',s.secondaryNo||'');
  setPartyField('sm-postal-code',s.postalCode||''); setPartyField('sm-district',s.district||''); setPartyField('sm-district-ar',s.districtAr||''); setPartyField('sm-city',s.city||''); setPartyField('sm-city-ar',s.cityAr||''); setPartyField('sm-country',s.country||'Saudi Arabia'); setPartyField('sm-notes',s.notes||'');
  openModalWithSize('sup-modal');
}
async function saveSupplier() {
  const isNew = !editingSupId;
  const company = document.getElementById('sm-company').value.trim();
  if (!company) { showToast('Company name is required','error'); return; }
  const email=getPartyField('sm-email');
  if(!validOptionalEmail(email)){ showToast('Enter a valid supplier email address','error'); return; }
  const s = {
    ...(editingSupId ? (suppliers.find(x=>x.id===editingSupId)||{}) : {}),
    id: editingSupId || ('s'+Date.now().toString(36)),
    company, companyAr:getPartyField('sm-company-ar'), contact:getPartyField('sm-contact'), contactAr:getPartyField('sm-contact-ar'),
    mobile:getPartyField('sm-mobile'), phone:getPartyField('sm-phone'), email, whatsapp:getPartyField('sm-whatsapp'), cat:getPartyField('sm-cat'), vat:getPartyField('sm-vat'),
    shortAddress:getPartyField('sm-short-address'), buildingNo:getPartyField('sm-building-no'), street:getPartyField('sm-street'), streetAr:getPartyField('sm-street-ar'), secondaryNo:getPartyField('sm-secondary-no'),
    postalCode:getPartyField('sm-postal-code'), district:getPartyField('sm-district'), districtAr:getPartyField('sm-district-ar'), city:getPartyField('sm-city'), cityAr:getPartyField('sm-city-ar'), country:getPartyField('sm-country')||'Saudi Arabia', notes:getPartyField('sm-notes')
  };
  if (editingSupId) { const i=suppliers.findIndex(x=>x.id===editingSupId); if(i>-1) suppliers[i]=s; }
  else suppliers.push(s);
  await saveSuppliers();
  clearDirty(); closeModal('sup-modal');
  renderSuppliers();
  showToast(editingSupId?'Supplier updated':'Supplier added','success');
  if (quickAddContext === 'pricing_supplier' && isNew) {
    quickAddContext = null;
    document.getElementById('sup-modal').style.zIndex = '';
    document.getElementById('pricing-sup-search').value = s.company;
    pricingSupplierName = s.company;
    const body = document.querySelector('#pricing-modal .modal-body');
    if (body && body._savedScroll !== undefined) setTimeout(()=>{ body.scrollTop = body._savedScroll; },50);
    applyPrimarySupplierToPricingLines('blank');
    markDirty('pricing-modal');
  } else if (quickAddContext === 'pricing_supplier') {
    quickAddContext = null;
    document.getElementById('sup-modal').style.zIndex = '';
  }
  editingSupId = null;
}
async function deleteSupplier(id, sourceModalId='') {
  return requestMasterDelete('suppliers', [id], sourceModalId);
}

/* ══════════════════════════════════════════════════
   RFQ TRACKER
══════════════════════════════════════════════════ */
function nextRFQNo() {
  const today = new Date();
  const prefix = 'RFQ-'+today.getFullYear()+String(today.getMonth()+1).padStart(2,'0')+'-';
  const nums = rfqs.filter(r=>r.rfqNo.startsWith(prefix)).map(r=>parseInt(r.rfqNo.split('-').pop())||0);
  return prefix + String((nums.length ? Math.max(...nums) : 0)+1).padStart(3,'0');
}


function getRFQWorkflowStage(r) {
  if (!r) return 'New';
  if (r.status === 'No Bid') return 'No Bid';
  const quoteIds = new Set([
    ...(Array.isArray(r.quotationIds) ? r.quotationIds : []),
    r.quotationId,
    ...quotations.filter(q => q.rfqId === r.id).map(q => q.id)
  ].filter(Boolean));
  if ([...quoteIds].some(qid => salesOrders.some(so => so.quotationId === qid))) return 'Sales Order';
  if (quoteIds.size) return 'Quoted';
  if ((r.pricingItems && r.pricingItems.length) || (r.pricingVersions && r.pricingVersions.length)) return 'Pricing';
  return r.status || 'New';
}

function rfqAge(rfq) {
  // Get today's date string YYYY-MM-DD in local time (no timezone issues)
  const now = new Date();
  const todayStr = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  const rfqDateStr = (rfq.date||'').substring(0,10);
  const dueStr = (rfq.due||'').substring(0,10);

  // Calendar day difference by comparing date strings (avoids all timezone problems)
  const toMs = s => { const [y,m,d]=(s||todayStr).split('-').map(Number); return Date.UTC(y,m-1,d); };
  const ageDays = Math.round((toMs(todayStr) - toMs(rfqDateStr)) / 86400000);

  // Overdue: due date is before today and RFQ is not yet Quoted
  const workflowStage = getRFQWorkflowStage(rfq);
  const overdue = dueStr < todayStr && !['Quoted','Sales Order','No Bid'].includes(workflowStage);

  // Human-friendly age label
  let ageLabel;
  if (ageDays <= 0)     ageLabel = 'Today';
  else if (ageDays===1) ageLabel = 'Yesterday';
  else                  ageLabel = ageDays + ' days ago';

  return {ageDays, overdue, dueStr: fmtDate(rfq.due), ageLabel};
}

function renderRFQPage() {
  const today = new Date().toISOString().split('T')[0];
  const getRfqDisplayStatus = r => {
    const stage = getRFQWorkflowStage(r);
    if (['Quoted','Sales Order','No Bid'].includes(stage)) return stage;
    if (r.due && r.due.substring(0,10) < today) return 'Overdue';
    return stage;
  };

  const search = (document.getElementById('rfq-search')?.value || '').trim().toLowerCase();
  const statusFiltered = rfqFilter === 'all'
    ? rfqs
    : rfqFilter === 'Open'
      ? rfqs.filter(r => !['Quoted','Sales Order','No Bid'].includes(getRFQWorkflowStage(r)))
    : rfqFilter === 'Overdue'
      ? rfqs.filter(r => getRfqDisplayStatus(r) === 'Overdue')
      : rfqFilter === 'Quoted'
        ? rfqs.filter(r => ['Quoted','Sales Order'].includes(getRFQWorkflowStage(r)))
        : rfqs.filter(r => getRFQWorkflowStage(r) === rfqFilter);

  const dateFiltered = statusFiltered.filter(r => rfqMatchesDateFilter(r));

  const filtered = dateFiltered.filter(r => {
    if (!search) return true;
    return [r.rfqNo, r.company, r.ref, r.desc, r.assigned, r.channel]
      .some(v => String(v || '').toLowerCase().includes(search));
  });
  let sorted = [...filtered].sort((a,b) => (b.date||'').localeCompare(a.date||''));

  const open    = rfqs.filter(r => !['Quoted','Sales Order','No Bid'].includes(getRFQWorkflowStage(r)));
  const overdue = rfqs.filter(r => getRfqDisplayStatus(r) === 'Overdue');
  const quoted  = rfqs.filter(r => ['Quoted','Sales Order'].includes(getRFQWorkflowStage(r)));
  const noBid   = rfqs.filter(r => getRFQWorkflowStage(r) === 'No Bid');

  const totalRfqKpi = document.getElementById('rfq-k-total');
  if (totalRfqKpi) totalRfqKpi.textContent = rfqs.length;
  document.getElementById('rfq-k-open').textContent    = open.length;
  document.getElementById('rfq-k-overdue').textContent = overdue.length;
  document.getElementById('rfq-k-pricing').textContent = rfqs.filter(r=>getRFQWorkflowStage(r)==='Pricing').length;
  document.getElementById('rfq-k-quoted').textContent  = quoted.length;
  document.getElementById('rfq-k-nobid').textContent   = noBid.length;
  updateRFQMonitorSelection();

  const setCount = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val?'('+val+')':''; };
  setCount('rfq-cnt-all',     rfqs.length);
  setCount('rfq-cnt-new',     rfqs.filter(r=>getRFQWorkflowStage(r)==='New').length);
  setCount('rfq-cnt-pricing', rfqs.filter(r=>getRFQWorkflowStage(r)==='Pricing').length);
  setCount('rfq-cnt-quoted',  quoted.length);
  setCount('rfq-cnt-nobid',   noBid.length);
  setCount('rfq-cnt-overdue', overdue.length);

  const newCount = rfqs.filter(r=>getRFQWorkflowStage(r)==='New').length;
  const pb = document.getElementById('pricing-badge');
  if (pb) { const pc=getPricingDocuments().filter(d=>d.status==='Saved').length; pb.textContent=pc; pb.style.display=pc?'inline-flex':'none'; pb.title=pc+' saved pricing document'+(pc===1?'':'s'); pb.setAttribute('aria-label',pb.title); }
  const badge = document.getElementById('rfq-badge');
  if (badge) {
    badge.textContent = newCount;
    badge.style.display = newCount ? 'inline-flex' : 'none';
    badge.setAttribute('aria-label', newCount + ' RFQ' + (newCount===1?'':'s') + ' requiring attention');
    badge.title = newCount + ' new RFQ' + (newCount===1?'':'s') + ' requiring attention';
  }

  document.getElementById('rfq-k-avg').textContent = '—';
  const openWithDates = open.filter(r=>r.date);
  if (openWithDates.length) {
    const now = new Date();
    const avgDays = openWithDates.reduce((sum,r)=>sum+Math.max(0,(now-new Date(r.date))/86400000),0)/openWithDates.length;
    document.getElementById('rfq-k-avg').textContent = avgDays < 1 ? '<1d' : avgDays.toFixed(1)+'d';
  }
  document.querySelectorAll('.rfq-main-monitor-item').forEach(el=>el.classList.remove('active'));

  sorted=sortRegisterRows(sorted,'rfq',{no:r=>r.rfqNo,customer:r=>r.company,reference:r=>r.ref,date:r=>r.date,due:r=>r.due||'',status:r=>getRFQWorkflowStage(r),progress:r=>{const qs=quotations.filter(q=>q.rfqId===r.id);return qs.some(q=>salesOrders.some(so=>so.quotationId===q.id))?'Sales Order':qs.length?'Quotation':(r.pricingItems&&r.pricingItems.length)?'Pricing':r.status||'RFQ'}});

  const list = document.getElementById('rfq-list');
  if (!sorted.length) {
    list.innerHTML = `<div class="empty-state"><i class="ti ti-clipboard-list"></i><strong>No RFQs found</strong><p>Try another filter or search term.</p></div>`;
    const rp = document.getElementById('rfq-pagination'); if (rp) rp.innerHTML = '';
    return;
  }
  const rfqPages = Math.ceil(sorted.length / RFQ_PER_PAGE) || 1;
  if (rfqPage > rfqPages) rfqPage = 1;
  const pageSlice = sorted.slice((rfqPage-1)*RFQ_PER_PAGE, rfqPage*RFQ_PER_PAGE);

  const rows = pageSlice.map(r => {
    const {overdue, dueStr} = rfqAge(r);
    const displayStatus = overdue ? 'Overdue' : getRFQWorkflowStage(r);
    const stClassMap = {'New':'badge-rfq-new','Pricing':'badge-rfq-pricing','Quoted':'badge-rfq-quoted','Sales Order':'badge-rfq-quoted','No Bid':'badge-rfq-nobid','Overdue':'badge-rfq-overdue'};
    const stClass = stClassMap[displayStatus] || 'badge-rfq-new';
    const hasPricing = !!(r.pricingItems && r.pricingItems.length);
    const quoteIds = new Set([...(r.quotationIds||[]),r.quotationId,...quotations.filter(q=>q.rfqId===r.id).map(q=>q.id)].filter(Boolean));
    const hasQuote = quoteIds.size>0;
    const hasSO = [...quoteIds].some(qid=>salesOrders.some(so=>so.quotationId===qid));
    let progress = '<i class="ti ti-circle-dot"></i> RFQ';
    if (hasSO) progress = '<i class="ti ti-shopping-cart-check"></i> Sales Order';
    else if (hasQuote) progress = '<i class="ti ti-file-check"></i> Quotation';
    else if (hasPricing) progress = '<i class="ti ti-calculator"></i> Pricing';
    else if (r.status === 'No Bid') progress = '<i class="ti ti-circle-off"></i> Closed';
    const dateText = fmtDate(r.date);
    return `<tr onclick="viewRFQ('${r.id}')" title="Open ${r.rfqNo}">
      <td class="rfq-cell-no">${r.rfqNo}</td>
      <td class="rfq-cell-customer" title="${r.company||''}">${r.company||'—'}</td>
      <td class="rfq-cell-muted" title="${r.ref||''}">${r.ref||'—'}</td>
      <td class="rfq-cell-muted">${dateText}</td>
      <td class="rfq-cell-muted" style="${overdue?'color:var(--red);font-weight:700':''}">${dueStr}</td>
      <td><span class="badge ${stClass}">${displayStatus}</span></td>
      <td><span class="rfq-progress">${progress}</span></td>
    </tr>`;
  }).join('');

  list.innerHTML = `<div class="rfq-register"><table>
    <colgroup><col style="width:15%"><col style="width:26%"><col style="width:16%"><col style="width:11%"><col style="width:11%"><col style="width:10%"><col style="width:11%"></colgroup>
    <thead><tr><th class="sortable-register-th" data-sort-screen="rfq" data-sort-key="no" onclick="event.stopPropagation();setRegisterSort('rfq','no',renderRFQPage)">RFQ No.</th><th class="sortable-register-th" data-sort-screen="rfq" data-sort-key="customer" onclick="event.stopPropagation();setRegisterSort('rfq','customer',renderRFQPage)">Customer</th><th class="sortable-register-th" data-sort-screen="rfq" data-sort-key="reference" onclick="event.stopPropagation();setRegisterSort('rfq','reference',renderRFQPage)">Reference</th><th class="sortable-register-th" data-sort-screen="rfq" data-sort-key="date" onclick="event.stopPropagation();setRegisterSort('rfq','date',renderRFQPage)">RFQ Date</th><th class="sortable-register-th" data-sort-screen="rfq" data-sort-key="due" onclick="event.stopPropagation();setRegisterSort('rfq','due',renderRFQPage)">Due Date</th><th class="sortable-register-th" data-sort-screen="rfq" data-sort-key="status" onclick="event.stopPropagation();setRegisterSort('rfq','status',renderRFQPage)">Status</th><th class="sortable-register-th" data-sort-screen="rfq" data-sort-key="progress" onclick="event.stopPropagation();setRegisterSort('rfq','progress',renderRFQPage)">Progress</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
  updateRegisterSortIndicators();
  document.querySelectorAll('.rows-per-page-select').forEach(el=>{ if(el.value!=String(RFQ_PER_PAGE)) el.value = String(RFQ_PER_PAGE); });
  const rp = document.getElementById('rfq-pagination');
  if (rp) rp.innerHTML = buildPaginationHTML(rfqPage, rfqPages, 'goRFQPage');
}
function goRFQPage(p){ rfqPage=p; renderRFQPage(); }


function updateRFQMonitorSelection(){
  const styles={
    all:{bg:'#eef6ff',accent:'#2e75b6'},
    Open:{bg:'#eef9f2',accent:'#43a66b'},
    Pricing:{bg:'#fff8e5',accent:'#d7a323'},
    Quoted:{bg:'#eef6ff',accent:'#3b82c4'},
    'No Bid':{bg:'#f2f4f6',accent:'#7b8794'},
    Overdue:{bg:'#fff0f0',accent:'#d85b5b'}
  };
  document.querySelectorAll('#page-rfq [data-rfq-monitor-filter]').forEach(el=>{
    const key=el.dataset.rfqMonitorFilter||'';
    const active=key===rfqFilter;
    el.classList.toggle('active',active);
    el.setAttribute('aria-pressed',active?'true':'false');
    if(active){
      const s=styles[key]||styles.all;
      el.style.setProperty('background-color',s.bg,'important');
      el.style.setProperty('box-shadow',`inset 3px 0 0 ${s.accent}`,'important');
    }else{
      el.style.removeProperty('background-color');
      el.style.removeProperty('box-shadow');
    }
  });
}

function applyRFQMonitorFilter(status, btn) {
  rfqFilter = status || 'all'; rfqPage = 1;
  document.querySelectorAll('[id^="rfq-f-"]').forEach(b=>b.classList.remove('active'));
  const map={all:'rfq-f-all',Open:'rfq-f-all',Overdue:'rfq-f-overdue',Pricing:'rfq-f-pricing',Quoted:'rfq-f-quoted','No Bid':'rfq-f-nobid'};
  const toolbarBtn=document.getElementById(map[rfqFilter]);
  if(toolbarBtn) toolbarBtn.classList.add('active');
  updateRFQMonitorSelection();
  renderRFQPage();
  updateRFQMonitorSelection();
}
function moduleMonitorStorageKey(moduleKey){ return `bizcore-${moduleKey}-monitor-collapsed`; }
function getModuleMonitorWorkspace(moduleKey){
  const ids={rfq:'rfq-main-workspace',quotations:'quotation-main-workspace',pricing:'pricing-main-workspace',salesorders:'salesorders-main-workspace'};
  return document.getElementById(ids[moduleKey]||'');
}
function setModuleMonitorState(moduleKey, collapsed, persist=true){
  const workspace=getModuleMonitorWorkspace(moduleKey);
  if(!workspace) return;
  workspace.classList.toggle('monitor-collapsed',!!collapsed);
  workspace.classList.toggle('monitor-expanded',!collapsed);
  if(persist) localStorage.setItem(moduleMonitorStorageKey(moduleKey),collapsed?'1':'0');
}
function toggleModuleMonitor(moduleKey){
  const workspace=getModuleMonitorWorkspace(moduleKey);
  if(!workspace) return;
  setModuleMonitorState(moduleKey,!workspace.classList.contains('monitor-collapsed'),true);
}
function restoreModuleMonitors(){
  ['rfq','quotations','pricing','salesorders'].forEach(moduleKey=>{
    const workspace=getModuleMonitorWorkspace(moduleKey);
    if(!workspace) return;
    const saved=localStorage.getItem(moduleMonitorStorageKey(moduleKey));
    // On smaller screens reclaim register width by default; once the user
    // chooses a state, that preference wins on later visits.
    const collapsed=saved===null ? window.innerWidth<=1100 : saved==='1';
    setModuleMonitorState(moduleKey,collapsed,false);
  });
}
function toggleRFQMainMonitor(){ toggleModuleMonitor('rfq'); }
function restoreRFQMainMonitor(){ restoreModuleMonitors(); }

function filterRFQ(status, btn) {
  rfqFilter = status; rfqPage = 1;
  document.querySelectorAll('[id^="rfq-f-"]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderRFQPage();
}

function clearAllRFQFilters() {
  rfqFilter = 'all'; rfqPage = 1;
  const search=document.getElementById('rfq-search'); if(search) search.value='';
  const from=document.getElementById('rfq-date-from'); if(from) from.value='';
  const to=document.getElementById('rfq-date-to'); if(to) to.value='';
  rfqDateFilter={preset:'all',from:'',to:''};
  updateRFQDateFilterUI();
  document.querySelectorAll('[id^="rfq-f-"]').forEach(b=>b.classList.remove('active'));
  document.getElementById('rfq-f-all')?.classList.add('active');
  updateRFQMonitorSelection();
  closeRFQDateMenu();
  renderRFQPage();
}


function rfqISODateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

function rfqDateRangeForPreset(preset) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === 'today') {
    const iso = rfqISODateLocal(today);
    return {from:iso,to:iso};
  }
  if (preset === 'week') {
    const from = new Date(today);
    from.setDate(today.getDate() - today.getDay()); // Sunday
    const to = new Date(from);
    to.setDate(from.getDate()+6);
    return {from:rfqISODateLocal(from),to:rfqISODateLocal(to)};
  }
  if (preset === 'month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    const to = new Date(today.getFullYear(), today.getMonth()+1, 0);
    return {from:rfqISODateLocal(from),to:rfqISODateLocal(to)};
  }
  if (preset === 'lastmonth') {
    const from = new Date(today.getFullYear(), today.getMonth()-1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    return {from:rfqISODateLocal(from),to:rfqISODateLocal(to)};
  }
  if (preset === '30days') {
    const from = new Date(today);
    from.setDate(today.getDate()-29);
    return {from:rfqISODateLocal(from),to:rfqISODateLocal(today)};
  }
  if (preset === 'last3months') {
    const from = new Date(today.getFullYear(), today.getMonth()-3, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    return {from:rfqISODateLocal(from),to:rfqISODateLocal(to)};
  }
  return {from:'',to:''};
}

function rfqMatchesDateFilter(r) {
  if (!rfqDateFilter || rfqDateFilter.preset === 'all') return true;
  const date = String(r?.date || '').substring(0,10);
  if (!date) return false;
  const from = rfqDateFilter.from || '';
  const to = rfqDateFilter.to || '';
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function toggleRFQDateMenu(event) {
  event?.stopPropagation();
  const menu = document.getElementById('rfq-date-menu');
  if (!menu) return;
  const willOpen = !menu.classList.contains('open');
  closeRFQDateMenu();
  if (willOpen) menu.classList.add('open');
}

function closeRFQDateMenu() {
  document.getElementById('rfq-date-menu')?.classList.remove('open');
}

function setRFQDatePreset(preset) {
  if (preset === 'all') rfqDateFilter = {preset:'all',from:'',to:''};
  else {
    const range = rfqDateRangeForPreset(preset);
    rfqDateFilter = {preset, ...range};
  }
  updateRFQDateFilterUI();
  closeRFQDateMenu();
  renderRFQPage();
}

function applyRFQCustomDate() {
  const from = document.getElementById('rfq-date-from')?.value || '';
  const to = document.getElementById('rfq-date-to')?.value || '';
  if (!from && !to) {
    setRFQDatePreset('all');
    return;
  }
  if (from && to && from > to) {
    showToast('From date cannot be after To date','warning');
    return;
  }
  rfqDateFilter = {preset:'custom',from,to};
  updateRFQDateFilterUI();
  closeRFQDateMenu();
  renderRFQPage();
}

function clearRFQDateFilter() {
  const from = document.getElementById('rfq-date-from');
  const to = document.getElementById('rfq-date-to');
  if (from) from.value='';
  if (to) to.value='';
  setRFQDatePreset('all');
}

function updateRFQDateFilterUI() {
  const label = document.getElementById('rfq-date-filter-label');
  const btn = document.getElementById('rfq-date-filter-btn');
  const labels = {all:'All Dates',today:'Today',week:'This Week',month:'This Month',lastmonth:'Last Month','30days':'Last 30 Days',last3months:'Last 3 Months'};
  let text = labels[rfqDateFilter.preset] || 'Custom Range';
  if (rfqDateFilter.preset === 'custom') {
    if (rfqDateFilter.from && rfqDateFilter.to) text = `${fmtDate(rfqDateFilter.from)} – ${fmtDate(rfqDateFilter.to)}`;
    else if (rfqDateFilter.from) text = `From ${fmtDate(rfqDateFilter.from)}`;
    else if (rfqDateFilter.to) text = `To ${fmtDate(rfqDateFilter.to)}`;
  }
  if (label) label.textContent = text;
  btn?.classList.toggle('active', rfqDateFilter.preset !== 'all');
  document.querySelectorAll('.rfq-date-preset').forEach(el=>el.classList.toggle('active',el.dataset.preset===rfqDateFilter.preset));
}

if (!window.__bizcoreRFQDateMenuBound) {
  window.__bizcoreRFQDateMenuBound = true;
  document.addEventListener('click', e => {
    if (!e.target.closest('.rfq-date-filter-wrap')) closeRFQDateMenu();
  });
}

// RFQ Customer dropdown
let rfqCustActiveIndex = -1;
function openRFQCustDD() { rfqCustActiveIndex=-1; filterRFQCustDD(); const input=document.getElementById('rfq-cust-search'); if(input) input.setAttribute('aria-expanded','true'); }
function closeRFQCustDD() { const dd=document.getElementById('rfq-cust-dd'); if(dd) dd.classList.remove('open'); const input=document.getElementById('rfq-cust-search'); if(input) input.setAttribute('aria-expanded','false'); rfqCustActiveIndex=-1; }
function handleRFQCustomerInput() {
  const input=document.getElementById('rfq-cust-search');
  if(!input) return;
  // Any manual change invalidates the previous master-data selection.
  // The RFQ can only be saved after a customer is selected from Customer Master.
  input.dataset.custId='';
  populateRFQContacts(null);
  filterRFQCustDD();
}
function filterRFQCustDD() {
  const searchEl = document.getElementById('rfq-cust-search');
  const q = searchEl.value.toLowerCase();
  const dd = document.getElementById('rfq-cust-dd');
  const matches = customers.filter(c=>!q||c.company.toLowerCase().includes(q));
  const customerRows = matches.map(c=>`<div class="cust-option" data-rfq-customer-id="${c.id}" role="option" aria-selected="false" onmousedown="selectRFQCustomer('${c.id}')"><div class="co-name">${c.company}</div><div class="co-sub">${c.contact||''}</div></div>`).join('');
  const addLabel = searchEl.value.trim() ? `Add “${searchEl.value.trim()}” as new customer` : 'Add new customer';
  dd.innerHTML = customerRows + `<div class="cust-option add-new" data-rfq-add-new="1" role="option" aria-selected="false" onmousedown="quickAddCustomerFromRFQ(event)"><i class="ti ti-plus" style="margin-right:6px"></i>${addLabel}</div>`;
  dd.classList.add('open'); searchEl.setAttribute('aria-expanded','true'); rfqCustActiveIndex=-1;
}
function getRFQCustomerOptions(){ return Array.from(document.querySelectorAll('#rfq-cust-dd .cust-option')); }
function highlightRFQCustomerOption(index){ const opts=getRFQCustomerOptions(); if(!opts.length){rfqCustActiveIndex=-1;return;} rfqCustActiveIndex=Math.max(0,Math.min(index,opts.length-1)); opts.forEach((opt,i)=>{const active=i===rfqCustActiveIndex;opt.classList.toggle('keyboard-active',active);opt.setAttribute('aria-selected',active?'true':'false');}); opts[rfqCustActiveIndex]?.scrollIntoView({block:'nearest'}); }
function handleRFQCustomerKeydown(event){ const dd=document.getElementById('rfq-cust-dd'); const open=dd?.classList.contains('open'); if(event.key==='ArrowDown'){event.preventDefault();if(!open)openRFQCustDD();highlightRFQCustomerOption(rfqCustActiveIndex<0?0:rfqCustActiveIndex+1);return;} if(event.key==='ArrowUp'){event.preventDefault();if(!open)openRFQCustDD();const opts=getRFQCustomerOptions();highlightRFQCustomerOption(rfqCustActiveIndex<0?Math.max(0,opts.length-1):rfqCustActiveIndex-1);return;} if(event.key==='Enter'&&open){event.preventDefault();const opt=getRFQCustomerOptions()[rfqCustActiveIndex];if(!opt)return;if(opt.dataset.rfqAddNew==='1')quickAddCustomerFromRFQ(event);else if(opt.dataset.rfqCustomerId)selectRFQCustomer(opt.dataset.rfqCustomerId);return;} if(event.key==='Escape'&&open){event.preventDefault();closeRFQCustDD();return;} if(event.key==='Tab')closeRFQCustDD(); }
function rfqISOToDisplay(value){ const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m?`${m[3]}/${m[2]}/${m[1]}`:String(value||''); }
function rfqDisplayToISO(value){ const raw=String(value||'').trim(); if(!raw)return ''; let m=raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/); if(!m)m=raw.match(/^(\d{2})(\d{2})(\d{4})$/); if(!m)return ''; const d=Number(m[1]),mo=Number(m[2]),y=Number(m[3]); const test=new Date(y,mo-1,d); if(test.getFullYear()!==y||test.getMonth()!==mo-1||test.getDate()!==d)return ''; return `${String(y).padStart(4,'0')}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function formatRFQDateTyping(input){ const digits=input.value.replace(/\D/g,'').slice(0,8); let out=digits; if(digits.length>2)out=digits.slice(0,2)+'/'+digits.slice(2); if(digits.length>4)out=digits.slice(0,2)+'/'+digits.slice(2,4)+'/'+digits.slice(4); input.value=out; }
function normalizeRFQDateField(input){ if(!input.value.trim())return; const iso=rfqDisplayToISO(input.value); if(iso){input.value=rfqISOToDisplay(iso);input.classList.remove('field-invalid');const picker=document.getElementById(input.id+'-picker');if(picker)picker.value=iso;}else input.classList.add('field-invalid'); }
function syncRFQDateFromPicker(textId,picker){ const input=document.getElementById(textId);if(!input)return;input.value=rfqISOToDisplay(picker.value);input.classList.remove('field-invalid');input.dispatchEvent(new Event('input',{bubbles:true})); }
function openRFQDatePicker(textId,pickerId){ const text=document.getElementById(textId),picker=document.getElementById(pickerId);if(!picker)return;const iso=rfqDisplayToISO(text?.value||'');if(iso)picker.value=iso;if(typeof picker.showPicker==='function')picker.showPicker();else picker.click(); }
function handleRFQDateKeydown(event,input,pickerId){ if((event.altKey&&event.key==='ArrowDown')||event.key==='F4'){event.preventDefault();openRFQDatePicker(input.id,pickerId);return;} if(event.key==='Enter'){event.preventDefault();normalizeRFQDateField(input);const fields=getRFQEntryTabFields();const idx=fields.indexOf(input);fields[idx+1]?.focus();} }
function getRFQEntryTabFields(){ return ['rfq-cust-search','rfq-contact','rfq-ref','rfq-channel','rfq-assigned','rfq-date','rfq-due','rfq-desc'].map(id=>document.getElementById(id)).filter(Boolean); }
function setupRFQEntryKeyboard(){ const modal=document.getElementById('rfq-modal');if(!modal)return;getRFQEntryTabFields().forEach(el=>el.removeAttribute('tabindex'));const attach=modal.querySelector('.rfq-attach-compact');if(attach)attach.setAttribute('tabindex','0');closeRFQCustDD();requestAnimationFrame(()=>{const el=document.getElementById('rfq-cust-search');if(el)el.focus();closeRFQCustDD();}); }

function populateRFQContacts(customer, selectedName='') {
  const select = document.getElementById('rfq-contact');
  const contacts = customer ? (customer.contacts||(customer.contact?[{name:customer.contact,isDefault:true}]:[])) : [];
  if (!contacts.length) {
    select.innerHTML = '<option value="">No contact persons available</option>';
    select.value = '';
    return;
  }
  select.innerHTML = contacts.map(ct=>`<option value="${ct.name.replace(/"/g,'&quot;')}">${ct.name}${ct.title?' — '+ct.title:''}${ct.isDefault?' (Default)':''}</option>`).join('');
  const def = contacts.find(x=>x.isDefault)||contacts[0];
  select.value = contacts.some(x=>x.name===selectedName) ? selectedName : (def?.name||'');
}
function selectRFQCustomer(id, selectedContact='') {
  const c = customers.find(x=>x.id===id); if (!c) return;
  document.getElementById('rfq-cust-search').value = c.company;
  document.getElementById('rfq-cust-search').dataset.custId = id;
  populateRFQContacts(c, selectedContact);
  closeRFQCustDD();
}
function quickAddCustomerFromRFQ(event) {
  if (event) event.preventDefault();
  quickAddContext = 'rfq_customer';
  const suggestedName = document.getElementById('rfq-cust-search').value.trim();
  const body = document.querySelector('#rfq-modal .modal-body');
  if (body) body._savedScroll = body.scrollTop;
  editingCustId = null;
  document.getElementById('cust-modal-title').textContent = 'Add new customer';
  resetCustomerPartyFields(suggestedName);
  document.getElementById('cm-contacts-list').innerHTML = '';
  addContactRow();
  document.getElementById('cust-modal').style.zIndex = '1200';
  closeRFQCustDD();
  openModalWithSize('cust-modal');
}

function employeeDaysUntil(dateValue) {
  if(!dateValue) return null;
  const end=new Date(dateValue+'T23:59:59');
  if(Number.isNaN(end.getTime())) return null;
  return Math.ceil((end-new Date())/86400000);
}
function employeeExpiryMeta(dateValue,label) {
  const days=employeeDaysUntil(dateValue);
  if(days===null) return {cls:'none',text:'Not recorded',days:null};
  if(days<0) return {cls:'expired',text:`Expired ${Math.abs(days)}d ago`,days};
  if(days<=30) return {cls:'urgent',text:`Expires in ${days}d`,days};
  if(days<=90) return {cls:'warning',text:`Expires in ${days}d`,days};
  return {cls:'valid',text:new Date(dateValue+'T00:00:00').toLocaleDateString('en-GB'),days};
}
function populateRFQAssignees(selectedValue='') {
  const select=document.getElementById('rfq-assigned'); if(!select)return;
  const activeSales=employees.filter(e=>e.active!==false && (e.roles||[]).includes('Sales')).sort((a,b)=>a.name.localeCompare(b.name));
  select.innerHTML='<option value="">Select employee</option>'+activeSales.map(e=>`<option value="${e.id}">${esc(e.name)}${e.designation?' — '+esc(e.designation):''}</option>`).join('');
  if(selectedValue){
    const byId=employees.find(e=>e.id===selectedValue);
    const byName=employees.find(e=>e.name===selectedValue);
    if(byId||byName) select.value=(byId||byName).id;
  }
}
function getEmployeeDisplay(idOrName) {
  return employees.find(e=>e.id===idOrName)?.name || employees.find(e=>e.name===idOrName)?.name || idOrName || '';
}
function getNextEmployeeCode() {
  const nums=employees.map(e=>String(e.code||'').match(/^EMP-(\d{4})$/i)).filter(Boolean).map(m=>Number(m[1]));
  return `EMP-${String((nums.length?Math.max(...nums):0)+1).padStart(4,'0')}`;
}
function updateEmployeePhotoPreview() {
  const box=document.getElementById('emp-photo-preview'), remove=document.getElementById('emp-photo-remove'); if(!box)return;
  if(employeePhotoDraft){box.innerHTML=`<img src="${employeePhotoDraft}" alt="Employee photo"/>`; if(remove)remove.style.display='inline-flex';}
  else{box.innerHTML='<i class="ti ti-user"></i>'; if(remove)remove.style.display='none';}
}
let employeePhotoUploadPromise = null;
let employeePhotoUploadFailed = false;
let employeePhotoPath = null; // Storage path of the currently-saved photo, for cleanup on replace/remove
function handleEmployeePhoto(event) {
  const file=event.target.files?.[0]; if(!file)return;
  if(!file.type.startsWith('image/')){showToast('Please choose an image file','error');event.target.value='';return;}
  if(file.size>8*1024*1024){showToast('Photo must be smaller than 8 MB','error');event.target.value='';return;}

  const localPreview = URL.createObjectURL(file); // instant preview, no base64 needed
  const oldPath = employeePhotoPath; // the file this one is replacing, if any
  employeePhotoDraft = localPreview; employeePhotoUploadFailed = false; updateEmployeePhotoPreview();

  if (window.FB) {
    const path='employees/'+(editingEmployeeId||('new-'+Date.now().toString(36)))+'/'+Date.now()+'_'+file.name;
    employeePhotoUploadPromise = window.FB.uploadFile(path, file).then(url=>{
      if (url) {
        URL.revokeObjectURL(localPreview);
        employeePhotoDraft=url; employeePhotoPath=path; employeePhotoUploadFailed=false;
        updateEmployeePhotoPreview();
        if (oldPath) window.FB.deleteFile(oldPath); // best-effort, don't wait on it
      } else {
        employeePhotoUploadFailed = true;
        showToast('Photo upload failed — please try again before saving','error');
      }
      return url;
    });
  }
}
function removeEmployeePhoto(){
  if (employeePhotoPath && window.FB) window.FB.deleteFile(employeePhotoPath);
  employeePhotoDraft='';employeePhotoUploadPromise=null;employeePhotoUploadFailed=false;employeePhotoPath=null;
  const input=document.getElementById('emp-photo-input');if(input)input.value='';updateEmployeePhotoPreview();
}
function formatEmployeeDate(dateValue) {
  if(!dateValue) return 'Not recorded';
  const d=new Date(dateValue+'T00:00:00');
  return Number.isNaN(d.getTime()) ? 'Not recorded' : d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}
function openEmployeeView(id) {
  const e=employees.find(x=>x.id===id); if(!e)return;
  const overlay=document.getElementById('employee-view-overlay'), content=document.getElementById('employee-view-content'); if(!overlay||!content)return;
  const initials=esc((e.name||'?').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase());
  const photo=e.photo?`<img src="${e.photo}" alt="${esc(e.name)}"/>`:initials;
  const doc=(title,no,date)=>{const m=employeeExpiryMeta(date,title);return `<div class="employee-view-doc"><div class="employee-view-doc-icon"><i class="ti ti-id"></i></div><div><span>${esc(title)}</span><strong>${esc(no||'Not recorded')}</strong><small>${esc(formatEmployeeDate(date))}</small></div><span class="expiry-pill ${m.cls}">${esc(m.text)}</span></div>`};
  content.innerHTML=`
    <div class="employee-view-hero">
      <div class="employee-view-avatar">${photo}</div>
      <div class="employee-view-identity"><div class="employee-view-code">${esc(e.code||'')}</div><h2 id="employee-view-name">${esc(e.name||'Employee')}</h2><p>${esc(e.designation||'No designation')}${e.department?' · '+esc(e.department):''}</p><div class="employee-view-role-pills">${(e.roles||[]).map(r=>`<span>${esc(r)}</span>`).join('')||'<em>No operational role assigned</em>'}</div></div>
      <div class="employee-view-status-wrap"><span class="employee-status ${e.active!==false?'active':'inactive'}">${e.active!==false?'Active':'Inactive'}</span><button class="btn btn-primary" type="button" onclick="editEmployeeFromView('${e.id}')"><i class="ti ti-edit"></i>Edit employee</button><button class="btn btn-danger" type="button" onclick="deleteEmployee('${e.id}')"><i class="ti ti-trash"></i>Delete</button></div>
    </div>
    <div class="employee-view-grid">
      <section class="employee-view-section"><h3><i class="ti ti-address-book"></i>Contact & work details</h3><div class="employee-view-facts"><div><span>Department</span><strong>${esc(e.department||'Not recorded')}</strong></div><div><span>Designation</span><strong>${esc(e.designation||'Not recorded')}</strong></div><div><span>Email</span><strong>${esc(e.email||'Not recorded')}</strong></div><div><span>Mobile</span><strong>${esc(e.mobile||'Not recorded')}</strong></div></div></section>
      <section class="employee-view-section"><h3><i class="ti ti-file-certificate"></i>Employee documents</h3><div class="employee-view-docs">${doc('Iqama',e.iqamaNo,e.iqamaExpiry)}${doc('Passport',e.passportNo,e.passportExpiry)}${doc('Driving licence',e.licenseNo,e.licenseExpiry)}</div></section>
    </div>`;
  overlay.style.display='flex'; document.body.classList.add('employee-view-open');
  setTimeout(()=>overlay.querySelector('.employee-view-close')?.focus(),30);
}
function closeEmployeeView(){const overlay=document.getElementById('employee-view-overlay');if(overlay)overlay.style.display='none';document.body.classList.remove('employee-view-open');}
function editEmployeeFromView(id){closeEmployeeView();openEmployeeForm(id);}
async function deleteEmployee(id) {
  const e = employees.find(x => x.id === id);
  if (!e) return;

  const confirmed = await showConfirmAsync({
    icon: '🗑️',
    title: 'Move to Recycle Bin?',
    message: (e.name||'This employee') + ' will be moved to the Recycle Bin. You can restore them later, or they will remain there until permanently removed.',
    confirmText: 'Move to Recycle Bin',
    confirmClass: 'btn-danger'
  });
  if (!confirmed) return;

  const binEntry = {
    ...JSON.parse(JSON.stringify(e)),
    deletedAt: new Date().toISOString(),
    deletedBy: (window.currentUser && window.currentUser.email) || 'unknown',
    originalCollection: 'employees'
  };
  recycleBin.push(binEntry);
  employees = employees.filter(x => x.id !== id);

  await Promise.all([saveEmployees(), saveRecycleBin()]);
  closeEmployeeView();
  renderEmployees();
  populateRFQAssignees();
  showToast((e.name||'Employee') + ' moved to Recycle Bin', 'success');
}
function openEmployeeForm(id=null) {
  editingEmployeeId=id;
  const e=id?employees.find(x=>x.id===id):null;
  document.getElementById('employee-form-title').textContent=e?'Edit employee':'New employee';
  document.getElementById('emp-code').value=e?.code||getNextEmployeeCode();
  employeePhotoUploadPromise=null; employeePhotoUploadFailed=false; // discard any stale/stuck upload from a previous attempt
  employeePhotoPath=e?.photoPath||null;
  employeePhotoDraft=e?.photo||''; updateEmployeePhotoPreview();
  const photoInput=document.getElementById('emp-photo-input'); if(photoInput)photoInput.value='';
  document.getElementById('emp-name').value=e?.name||'';
  document.getElementById('emp-department').value=e?.department||'';
  document.getElementById('emp-designation').value=e?.designation||'';
  document.getElementById('emp-email').value=e?.email||'';
  document.getElementById('emp-mobile').value=e?.mobile||'';
  document.getElementById('emp-iqama').value=e?.iqamaNo||'';
  document.getElementById('emp-iqama-expiry').value=e?.iqamaExpiry||'';
  document.getElementById('emp-passport').value=e?.passportNo||'';
  document.getElementById('emp-passport-expiry').value=e?.passportExpiry||'';
  document.getElementById('emp-license').value=e?.licenseNo||'';
  document.getElementById('emp-license-expiry').value=e?.licenseExpiry||'';
  document.getElementById('emp-active').value=String(e?.active!==false);
  document.querySelectorAll('#employee-role-grid input').forEach(cb=>cb.checked=(e?.roles||[]).includes(cb.value));
  const panel=document.getElementById('employee-form-panel'); panel.style.display='block'; panel.scrollIntoView({behavior:'smooth',block:'start'});
  setTimeout(()=>document.getElementById('emp-name').focus(),120);
}
function closeEmployeeForm(){editingEmployeeId=null;document.getElementById('employee-form-panel').style.display='none';}
async function saveEmployee() {
  const name=document.getElementById('emp-name').value.trim(), code=document.getElementById('emp-code').value.trim();
  if(!code){showValidationDialog('Employee code required','Enter a unique employee code.',document.getElementById('emp-code'));return;}
  if(!name){showValidationDialog('Employee name required','Enter the employee name.',document.getElementById('emp-name'));return;}
  if(employees.some(e=>e.code.toLowerCase()===code.toLowerCase()&&e.id!==editingEmployeeId)){showValidationDialog('Duplicate employee code','This employee code is already in use.',document.getElementById('emp-code'));return;}
  const iqamaInput=document.getElementById('emp-iqama'), licenseInput=document.getElementById('emp-license');
  const iqamaNo=iqamaInput.value.trim(), licenseNo=licenseInput.value.trim();
  if(iqamaNo && !/^\d{10}$/.test(iqamaNo)){showValidationDialog('Invalid Iqama number','Iqama number must contain exactly 10 digits — not less or more.',iqamaInput);return;}
  if(licenseNo && !/^\d+$/.test(licenseNo)){showValidationDialog('Invalid driving licence number','Driving licence number can contain numbers only.',licenseInput);return;}
  if (employeePhotoUploadPromise) { showToast('Finishing photo upload…','success'); await employeePhotoUploadPromise; employeePhotoUploadPromise=null; }
  if (employeePhotoUploadFailed) { showValidationDialog('Photo upload failed','The employee photo could not be uploaded. Check your connection and try selecting the photo again, or remove it and save without one.',document.getElementById('emp-photo-input')); return; }
  const record={id:editingEmployeeId||('emp-'+Date.now().toString(36)),code,name,photo:employeePhotoDraft,photoPath:employeePhotoPath,department:document.getElementById('emp-department').value.trim(),designation:document.getElementById('emp-designation').value.trim(),email:document.getElementById('emp-email').value.trim(),mobile:document.getElementById('emp-mobile').value.trim(),roles:[...document.querySelectorAll('#employee-role-grid input:checked')].map(x=>x.value),iqamaNo:iqamaNo,iqamaExpiry:document.getElementById('emp-iqama-expiry').value,passportNo:document.getElementById('emp-passport').value.trim(),passportExpiry:document.getElementById('emp-passport-expiry').value,licenseNo:licenseNo,licenseExpiry:document.getElementById('emp-license-expiry').value,active:document.getElementById('emp-active').value==='true',updated:new Date().toISOString()};
  const existing=editingEmployeeId?employees.find(e=>e.id===editingEmployeeId):null;
  const persist=async()=>{
    showBusyOverlay('employee-form-panel', 'Saving employee…');
    try {
      if(editingEmployeeId){const i=employees.findIndex(e=>e.id===editingEmployeeId);if(i>-1)employees[i]=record;}else employees.unshift(record);
      await saveEmployees();
      closeEmployeeForm();renderEmployees();populateRFQAssignees();showToast(existing?'Employee updated':'Employee added','success');editingEmployeeId=null;
    } finally { hideBusyOverlay('employee-form-panel'); }
  };
  if(existing){
    const comparable=x=>JSON.stringify({code:x.code||'',name:x.name||'',photo:x.photo||'',department:x.department||'',designation:x.designation||'',email:x.email||'',mobile:x.mobile||'',roles:[...(x.roles||[])].sort(),iqamaNo:x.iqamaNo||'',iqamaExpiry:x.iqamaExpiry||'',passportNo:x.passportNo||'',passportExpiry:x.passportExpiry||'',licenseNo:x.licenseNo||'',licenseExpiry:x.licenseExpiry||'',active:x.active!==false});
    if(comparable(existing)===comparable(record)){showToast('No changes to save','info');return;}
    showConfirm({icon:'👤',title:'Confirm employee changes',message:`Save the changes made to ${esc(record.name)}?`,details:[['Employee',record.code+' · '+record.name],['Status',record.active?'Active':'Inactive']],confirmText:'Yes, save changes',confirmClass:'btn-primary',onConfirm:persist});
    return;
  }
  await persist();
}
function renderEmployees() {
  const tbody=document.getElementById('employees-tbody'); if(!tbody)return;
  const q=(document.getElementById('emp-search')?.value||'').toLowerCase(); const mode=document.getElementById('emp-status-filter')?.value||'active';
  let list=employees.filter(e=>!q||[e.code,e.name,e.department,e.designation,e.mobile,e.iqamaNo,...(e.roles||[])].join(' ').toLowerCase().includes(q));
  if(mode==='active') list=list.filter(e=>e.active!==false);
  if(mode==='expiring') list=list.filter(e=>[e.iqamaExpiry,e.passportExpiry,e.licenseExpiry].some(d=>{const n=employeeDaysUntil(d);return n!==null&&n<=90;}));
  list=sortRegisterRows(list,'employees',{employee:e=>e.name,department:e=>`${e.department||''} ${e.designation||''}`,roles:e=>(e.roles||[]).join(' '),contact:e=>`${e.mobile||''} ${e.email||''}`,iqama:e=>e.iqamaNo,passport:e=>e.passportNo,license:e=>e.licenseNo,status:e=>e.active!==false?'Active':'Inactive'});
  const employeePages=Math.ceil(list.length/PER_PAGE)||1;
  if(employeePage>employeePages) employeePage=1;
  const employeeSlice=list.slice((employeePage-1)*PER_PAGE,employeePage*PER_PAGE);
  document.querySelectorAll('.rows-per-page-select').forEach(el=>{ if(el.value!=String(PER_PAGE)) el.value=String(PER_PAGE); });
  const expiring=employees.flatMap(e=>[['Iqama',e.iqamaExpiry],['Passport',e.passportExpiry],['Driving licence',e.licenseExpiry]].map(([doc,date])=>({e,doc,date,days:employeeDaysUntil(date)}))).filter(x=>x.days!==null&&x.days<=90).sort((a,b)=>a.days-b.days);
  const summary=document.getElementById('employee-expiry-summary');
  if(summary) summary.innerHTML=expiring.length?`<div class="expiry-summary-icon"><i class="ti ti-bell-ringing"></i></div><div><strong>${expiring.length} document${expiring.length===1?'':'s'} need attention</strong><span>${expiring.filter(x=>x.days<0).length} expired · ${expiring.filter(x=>x.days>=0&&x.days<=30).length} due within 30 days · notification-ready for the future reminder module</span></div>`:`<div class="expiry-summary-icon safe"><i class="ti ti-shield-check"></i></div><div><strong>No document expiries within 90 days</strong><span>The employee records are ready for future expiry notifications.</span></div>`;
  tbody.innerHTML=employeeSlice.length?employeeSlice.map(e=>{
    const iq=employeeExpiryMeta(e.iqamaExpiry,'Iqama'), pp=employeeExpiryMeta(e.passportExpiry,'Passport'), dl=employeeExpiryMeta(e.licenseExpiry,'Driving licence');
    const doc=(no,date,meta)=>`<div class="employee-doc-cell"><strong>${esc(no||'—')}</strong><span class="expiry-pill ${meta.cls}">${esc(meta.text)}</span></div>`;
    return `<tr class="employee-clickable-row" tabindex="0" role="button" aria-label="View ${esc(e.name)}" onclick="openEmployeeView('${e.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openEmployeeView('${e.id}')}"><td><div class="employee-name-cell"><span class="employee-avatar">${e.photo?`<img src="${e.photo}" alt=""/>`:esc((e.name||'?').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase())}</span><div><strong>${esc(e.name)}</strong><small>${esc(e.code)}</small></div></div></td><td><strong>${esc(e.department||'—')}</strong><small class="employee-muted">${esc(e.designation||'')}</small></td><td><div class="employee-role-pills">${(e.roles||[]).map(r=>`<span>${esc(r)}</span>`).join('')||'<em>No role</em>'}</div></td><td>${esc(e.mobile||'—')}<small class="employee-muted">${esc(e.email||'')}</small></td><td>${doc(e.iqamaNo,e.iqamaExpiry,iq)}</td><td>${doc(e.passportNo,e.passportExpiry,pp)}</td><td>${doc(e.licenseNo,e.licenseExpiry,dl)}</td><td><span class="employee-status ${e.active!==false?'active':'inactive'}">${e.active!==false?'Active':'Inactive'}</span></td><td class="center"><button class="btn-icon employee-view-btn" title="View employee" onclick="event.stopPropagation();openEmployeeView('${e.id}')"><i class="ti ti-eye"></i></button><button class="btn-icon employee-view-btn" title="Delete employee" onclick="event.stopPropagation();deleteEmployee('${e.id}')"><i class="ti ti-trash" style="color:var(--red)"></i></button></td></tr>`;
  }).join(''):`<tr><td colspan="9"><div class="empty-state compact"><i class="ti ti-users-off"></i><p>No employees found.</p></div></td></tr>`;
  const ep=document.getElementById('employees-pagination'); if(ep) ep.innerHTML=buildPaginationHTML(employeePage,employeePages,'goEmployeePage');
}
function goEmployeePage(p){employeePage=p;renderEmployees();}

function handleRFQAttach(e) {
  const file = e.target.files[0]; if (!file) return;
  if (file.size > 10*1024*1024) { showToast('Attachment must be under 10MB','error'); e.target.value=''; return; }
  const localPreview = URL.createObjectURL(file); // instant preview, no base64 needed
  const oldPath = rfqAttachment?.path; // the file this one is replacing, if any

  rfqAttachment = {name:file.name, type:file.type, data:localPreview}; // local-only until upload finishes; never persisted as-is
  document.getElementById('rfq-attach-list').innerHTML =
    `<div class="attach-item"><i class="ti ti-${file.type.includes('pdf')?'pdf':'photo'}"></i>${file.name}<button onclick="if(rfqAttachment&&rfqAttachment.path&&window.FB)window.FB.deleteFile(rfqAttachment.path);rfqAttachment=null;this.closest('.attach-item').remove()" style="margin-left:auto;background:none;border:none;cursor:pointer;color:var(--red)"><i class="ti ti-x"></i></button></div>`;

  if (window.FB) {
    const thisAttachment = rfqAttachment;
    const path = 'rfqs/' + (editingRFQId || ('new-'+Date.now().toString(36))) + '/' + Date.now() + '_' + file.name;
    thisAttachment._uploadPromise = window.FB.uploadFile(path, file).then(url => {
      if (url) {
        URL.revokeObjectURL(localPreview);
        delete thisAttachment.data; thisAttachment.url = url; thisAttachment.path = path; thisAttachment._uploadFailed = false;
        if (oldPath) window.FB.deleteFile(oldPath); // best-effort, don't wait on it
      } else {
        thisAttachment._uploadFailed = true;
        showToast('Attachment upload failed — please try again before saving','error');
      }
      return url;
    });
  }
  e.target.value='';
}

function openNewRFQ() {
  editingRFQId = null;
  rfqAttachment = null;
  document.getElementById('rfq-modal-title').textContent = 'Log new RFQ';
  document.getElementById('rfq-edit-no').textContent = 'New record';
  document.getElementById('rfq-save-label').textContent = 'Save RFQ';
  setRFQFormState('saved');
  document.getElementById('rfq-cust-search').value='';
  document.getElementById('rfq-cust-search').dataset.custId='';
  populateRFQContacts(null);
  document.getElementById('rfq-channel').value='Email';
  document.getElementById('rfq-ref').value='';
  document.getElementById('rfq-desc').value='';
  populateRFQAssignees();
  const defaultAssignee=employees.find(e=>e.active!==false&&(e.roles||[]).includes('Sales'));
  document.getElementById('rfq-assigned').value=defaultAssignee?.id||'';
  document.getElementById('rfq-attach-list').innerHTML='';
  // Dates
  const today=new Date(), due=new Date(today);
  due.setHours(due.getHours()+(settings.rfqDefaultHours||48));
  const fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const receivedISO=fmt(today), dueISO=fmt(due);
  document.getElementById('rfq-date').value=rfqISOToDisplay(receivedISO);
  document.getElementById('rfq-due').value=rfqISOToDisplay(dueISO);
  const receivedPicker=document.getElementById('rfq-date-picker');if(receivedPicker)receivedPicker.value=receivedISO;
  const duePicker=document.getElementById('rfq-due-picker');if(duePicker)duePicker.value=dueISO;
  openModalWithSize('rfq-modal');
  setupRFQEntryKeyboard();
}


function confirmCancelRFQEntry(){
  const isEdit=!!editingRFQId;
  const title=isEdit?'Discard RFQ changes?':'Discard new RFQ?';
  const message=isEdit
    ? 'Changes made in this RFQ have not been saved.'
    : 'This RFQ has not been saved yet.';
  const secondary=isEdit
    ? 'Discarding will close the form without saving the latest changes.'
    : 'Discarding will close the form and remove this new entry.';
  if(typeof window.bizcoreShowSafeDialog==='function'){
    window.bizcoreShowSafeDialog({
      icon:'ti-alert-triangle',
      title,
      message,
      secondary,
      buttons:[
        {text:'Continue editing',cls:'secondary',action:()=>{}},
        {text:isEdit?'Discard changes':'Discard RFQ',cls:'danger-outline',action:()=>{
          if(typeof window.closeEntryWithTransition==='function') window.closeEntryWithTransition('rfq-modal','RFQ');
          else if(typeof window.bizcorePerformClose==='function') window.bizcorePerformClose('rfq-modal',true);
          else closeModal('rfq-modal');
        }}
      ]
    });
  }
}

function confirmCancelQuotationEntry(){
  const isEdit=!!editingId;
  const title=isEdit?'Discard quotation changes?':'Discard new quotation?';
  const message=isEdit
    ? 'Changes made in this quotation have not been saved.'
    : 'This quotation has not been saved yet.';
  const secondary=isEdit
    ? 'Discarding will close the form without saving the latest changes.'
    : 'Discarding will close the form and remove this new entry.';
  if(typeof window.bizcoreShowSafeDialog==='function'){
    window.bizcoreShowSafeDialog({
      icon:'ti-alert-triangle',
      title,
      message,
      secondary,
      buttons:[
        {text:'Continue editing',cls:'secondary',action:()=>{}},
        {text:isEdit?'Discard changes':'Discard quotation',cls:'danger-outline',action:()=>{
          if(typeof window.closeEntryWithTransition==='function') window.closeEntryWithTransition('quote-modal','quotation');
          else if(typeof window.bizcorePerformClose==='function') window.bizcorePerformClose('quote-modal',true);
          else closeModal('quote-modal');
        }}
      ]
    });
  }
}
window.confirmCancelQuotationEntry=confirmCancelQuotationEntry;

function getSelectedRFQCustomerForSave(){
  const input=document.getElementById('rfq-cust-search');
  const custId=String(input?.dataset?.custId||'').trim();
  const customer=customers.find(c=>String(c.id)===custId);
  const typed=String(input?.value||'').trim();
  if(!customer || typed!==String(customer.company||'').trim()) return null;
  return customer;
}
function normalizeRFQReference(value){
  return String(value||'').trim().replace(/\s+/g,' ').toLowerCase();
}
function getRFQReferenceDuplicates(customer, reference){
  if(!customer || !reference) return [];
  const wanted=normalizeRFQReference(reference);
  if(!wanted) return [];
  const customerName=String(customer.company||'').trim().toLowerCase();
  return rfqs.filter(r=>{
    if(editingRFQId && r.id===editingRFQId) return false;
    const sameCustomer = r.custId
      ? String(r.custId)===String(customer.id)
      : String(r.company||'').trim().toLowerCase()===customerName;
    return sameCustomer && normalizeRFQReference(r.ref)===wanted;
  }).sort((a,b)=>String(b.created||b.date||'').localeCompare(String(a.created||a.date||'')));
}
function showRFQFinalSaveConfirmation(){
  const isEdit=!!editingRFQId;
  const title=isEdit?'Update RFQ?':'Save new RFQ?';
  const message=isEdit
    ? 'Please confirm that the changes to this RFQ are ready to save.'
    : 'Please confirm that this RFQ is ready to create.';
  const secondary=isEdit
    ? 'The existing RFQ record will be updated.'
    : 'A new RFQ record will be created.';
  if(typeof window.bizcoreShowSafeDialog==='function'){
    window.bizcoreShowSafeDialog({
      icon:'ti-device-floppy',
      title,
      message,
      secondary,
      buttons:[
        {text:'Back',cls:'secondary',action:()=>{}},
        {text:isEdit?'Update RFQ':'Save RFQ',cls:'primary',action:()=>saveRFQ()}
      ]
    });
  }
}
function confirmSaveRFQEntry(){
  const custInput=document.getElementById('rfq-cust-search');
  const company=String(custInput?.value||'').trim();
  if(!company){
    showValidationDialog('Customer required','Select a customer from Customer Master before saving the RFQ.',custInput);
    return;
  }
  const customer=getSelectedRFQCustomerForSave();
  if(!customer){
    showValidationDialog(
      'Select a valid customer',
      'The customer must be selected from Customer Master. If this is a new customer, add it to Customer Master first and then select it here.',
      custInput
    );
    return;
  }

  const reference=String(document.getElementById('rfq-ref')?.value||'').trim();
  const continueAfterBlank=()=>{
    const duplicates=getRFQReferenceDuplicates(customer,reference);
    if(duplicates.length && typeof window.bizcoreShowSafeDialog==='function'){
      const first=duplicates[0];
      const more=duplicates.length>1?` and ${duplicates.length-1} more RFQ${duplicates.length>2?'s':''}`:'';
      window.bizcoreShowSafeDialog({
        icon:'ti-alert-triangle',
        title:'Possible duplicate reference / subject',
        message:`${esc(reference)} is already used for ${esc(customer.company)}.`,
        secondary:`Existing RFQ: ${esc(first.rfqNo||'RFQ')}${more}. You can still save if this duplicate is intentional.`,
        buttons:[
          {text:'Go Back',cls:'secondary',action:()=>document.getElementById('rfq-ref')?.focus()},
          {text:'Save Anyway',cls:'primary',action:()=>showRFQFinalSaveConfirmation()}
        ]
      });
      return;
    }
    showRFQFinalSaveConfirmation();
  };

  if(!reference && typeof window.bizcoreShowSafeDialog==='function'){
    window.bizcoreShowSafeDialog({
      icon:'ti-alert-triangle',
      title:'Customer Reference / Subject is blank',
      message:'No customer reference or subject has been entered for this RFQ.',
      secondary:'This field is optional. You can continue without it, or go back and enter the reference / subject.',
      buttons:[
        {text:'Go Back',cls:'secondary',action:()=>document.getElementById('rfq-ref')?.focus()},
        {text:'Continue',cls:'primary',action:continueAfterBlank}
      ]
    });
    return;
  }
  continueAfterBlank();
}
window.confirmCancelRFQEntry=confirmCancelRFQEntry;
window.confirmSaveRFQEntry=confirmSaveRFQEntry;

async function saveRFQ() {
  const custSearch = document.getElementById('rfq-cust-search');
  const company = custSearch.value.trim();
  if (!company) { showValidationDialog('Customer required','Select a customer from Customer Master before saving the RFQ.',custSearch); return; }
  const selectedCustomer=getSelectedRFQCustomerForSave();
  if(!selectedCustomer){
    showValidationDialog('Select a valid customer','The customer must be selected from Customer Master. If this is a new customer, add it to Customer Master first and then select it here.',custSearch);
    return;
  }
  const receivedISO=rfqDisplayToISO(document.getElementById('rfq-date').value);
  const dueISO=rfqDisplayToISO(document.getElementById('rfq-due').value);
  if(!receivedISO){showValidationDialog('Invalid received date','Enter the date as DD/MM/YYYY.',document.getElementById('rfq-date'));return;}
  if(!dueISO){showValidationDialog('Invalid due date','Enter the date as DD/MM/YYYY.',document.getElementById('rfq-due'));return;}
  if (rfqAttachment && rfqAttachment._uploadPromise) { showToast('Finishing attachment upload…','success'); await rfqAttachment._uploadPromise; delete rfqAttachment._uploadPromise; }
  if (rfqAttachment && rfqAttachment._uploadFailed) { showValidationDialog('Attachment upload failed','The RFQ attachment could not be uploaded. Check your connection and try attaching it again, or remove it and save without one.',document.getElementById('rfq-attach-list')); return; }
  showBusyOverlay('rfq-modal', 'Saving RFQ…');
  try {
  const r = {
    id: editingRFQId || ('r'+Date.now().toString(36)),
    rfqNo: editingRFQId ? rfqs.find(x=>x.id===editingRFQId)?.rfqNo : await allocateDocumentNumber('rfq',new Date(receivedISO+'T00:00:00')),
    company:selectedCustomer.company, custId:selectedCustomer.id,
    contact: document.getElementById('rfq-contact').value.trim(),
    channel: document.getElementById('rfq-channel').value,
    date: receivedISO,
    due: dueISO,
    assignedEmployeeId: document.getElementById('rfq-assigned').value,
    assigned: getEmployeeDisplay(document.getElementById('rfq-assigned').value),
    ref: document.getElementById('rfq-ref').value.trim(),
    desc: document.getElementById('rfq-desc').value.trim(),
    status: editingRFQId ? rfqs.find(x=>x.id===editingRFQId)?.status : 'New',
    attachment: rfqAttachment,
    pricingItems: editingRFQId ? rfqs.find(x=>x.id===editingRFQId)?.pricingItems||[] : [],
    internalCosts: editingRFQId ? rfqs.find(x=>x.id===editingRFQId)?.internalCosts||[] : [],
    supplierName: editingRFQId ? rfqs.find(x=>x.id===editingRFQId)?.supplierName||'' : '',
    supRef: editingRFQId ? rfqs.find(x=>x.id===editingRFQId)?.supRef||'' : '',
    supDate: editingRFQId ? rfqs.find(x=>x.id===editingRFQId)?.supDate||'' : '',
    internalNotes: editingRFQId ? rfqs.find(x=>x.id===editingRFQId)?.internalNotes||'' : '',
    vendorQuotes: editingRFQId ? rfqs.find(x=>x.id===editingRFQId)?.vendorQuotes||[] : [],
    pricingAttachment: editingRFQId ? rfqs.find(x=>x.id===editingRFQId)?.pricingAttachment||null : null,
    pricingVersions: editingRFQId ? rfqs.find(x=>x.id===editingRFQId)?.pricingVersions||[] : [],
    currentPricingVersion: editingRFQId ? rfqs.find(x=>x.id===editingRFQId)?.currentPricingVersion||1 : 1,
    quotationId: editingRFQId ? rfqs.find(x=>x.id===editingRFQId)?.quotationId : null,
    quotationIds: editingRFQId ? rfqs.find(x=>x.id===editingRFQId)?.quotationIds||[] : [],
    quotedDate: editingRFQId ? rfqs.find(x=>x.id===editingRFQId)?.quotedDate||null : null,
    created: editingRFQId ? rfqs.find(x=>x.id===editingRFQId)?.created : new Date().toISOString()
  };
  if (editingRFQId) { const i=rfqs.findIndex(x=>x.id===editingRFQId); if(i>-1) rfqs[i]=r; }
  else rfqs.unshift(r);
  await saveRFQs();
  clearDirty(); closeModal('rfq-modal');
  renderRFQPage();
  showToast(editingRFQId?'RFQ updated':'RFQ logged — '+r.rfqNo,'success');
  editingRFQId=null; rfqAttachment=null;
  } finally { hideBusyOverlay('rfq-modal'); }
}

function toggleRFQDetailSection(titleEl) {
  const card = titleEl.closest('.rfq-view-card');
  if (!card) return;
  card.classList.toggle('is-collapsed');
  const expanded = !card.classList.contains('is-collapsed');
  titleEl.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

function viewRFQ(id) {
  const r = rfqs.find(x=>x.id===id); if (!r) return;
  const {ageDays, overdue, dueStr, ageLabel} = rfqAge(r);
  const displayStatus = overdue ? 'Overdue' : getRFQWorkflowStage(r);
  const stClassMap = {'New':'badge-rfq-new','Pricing':'badge-rfq-pricing','Quoted':'badge-rfq-quoted','Sales Order':'badge-rfq-quoted','No Bid':'badge-rfq-nobid','Overdue':'badge-rfq-overdue'};
  const stClass = stClassMap[displayStatus] || 'badge-rfq-new';
  const hasPricing = !!(r.pricingItems && r.pricingItems.length);
  const hasQuote = !!r.quotationId;
  const isNoBid = r.status === 'No Bid';
  const canDelete = !hasPricing && !hasQuote;
  document.getElementById('rfq-view-title').textContent = r.rfqNo + ' — ' + r.company;
  document.getElementById('rfq-view-body').className = 'modal-body rfq-view-body';
  document.getElementById('rfq-view-footer').className = 'modal-footer rfq-view-footer';

  const isImg = r.attachment && !r.attachment.type?.includes('pdf');
  const attachSrc = r.attachment ? (r.attachment.url || r.attachment.data) : null;
  const attachHtml = r.attachment
    ? `<div class="attach-item"><i class="ti ti-${r.attachment.type?.includes('pdf')?'pdf':'photo'}"></i><span style="flex:1;color:#475569">${r.attachment.name}</span>${isImg?`<button class="abtn abtn-view" onclick="document.getElementById('rfq-img-prev').style.display=document.getElementById('rfq-img-prev').style.display==='none'?'block':'none'"><i class="ti ti-eye"></i>View</button>`:''}<a href="${attachSrc}" download="${r.attachment.name}" target="_blank" rel="noopener" class="abtn abtn-edit" style="text-decoration:none"><i class="ti ti-download"></i>Download</a></div>${isImg?`<div id="rfq-img-prev" style="display:none;margin-top:8px;text-align:center;background:#f8fafc;border:1px solid var(--border);border-radius:7px;padding:10px"><img src="${attachSrc}" style="max-width:100%;max-height:420px;object-fit:contain;border-radius:4px"></div>`:''}` : '<div style="font-size:12px;color:#94a3b8">No attachment added.</div>';

  const reqItems = (r.pricingItems && r.pricingItems.length) ? r.pricingItems : [];
  const pricedCount = reqItems.filter(i => parseFloat(i.buy)>0 || parseFloat(i.sell)>0 || i.supplier || i.quoteRef).length;
  const pendingCount = Math.max(0, reqItems.length-pricedCount);
  const supplierCount = new Set(reqItems.map(i=>i.supplier).filter(Boolean)).size;
  const pricingProgress = reqItems.length ? Math.round((pricedCount/reqItems.length)*100) : 0;
  const pricingHtml = `<div class="rfq-progress-grid">
    <div class="rfq-progress-stat"><span>Total items</span><strong>${reqItems.length||'—'}</strong></div>
    <div class="rfq-progress-stat success"><span>Items priced</span><strong>${pricedCount}</strong></div>
    <div class="rfq-progress-stat warning"><span>Pending</span><strong>${pendingCount}</strong></div>
    <div class="rfq-progress-stat info"><span>Suppliers contacted</span><strong>${supplierCount}</strong></div>
    <div class="rfq-progress-bar-wrap"><div><span>Pricing completion</span><strong>${pricingProgress}%</strong></div><div class="rfq-progress-bar"><i style="width:${pricingProgress}%"></i></div></div>
  </div>`;
  const itemsHtml = reqItems.length ? `<div class="rfq-items-table-wrap"><table class="rfq-items-table"><thead><tr><th>#</th><th>Code</th><th>Description</th><th>Qty</th><th>UOM</th><th>Pricing status</th></tr></thead><tbody>${reqItems.map((i,n)=>`<tr><td>${n+1}</td><td>${i.code||'—'}</td><td>${i.desc||i.description||'—'}</td><td>${i.qty||'—'}</td><td>${i.uom||'—'}</td><td><span class="rfq-line-status ${parseFloat(i.buy)>0||parseFloat(i.sell)>0||i.supplier?'priced':'pending'}">${parseFloat(i.buy)>0||parseFloat(i.sell)>0||i.supplier?'Priced':'Pending'}</span></td></tr>`).join('')}</tbody></table></div>` : `<p class="rfq-view-requirements">${r.desc||'No requirement details entered.'}</p>`;

  let nextTitle='Start pricing', nextCopy='Add supplier cost and proposed selling prices for this RFQ.';
  if (isNoBid) { nextTitle='RFQ closed as No Bid'; nextCopy='Reopen it only when the opportunity becomes active again.'; }
  else if (hasQuote) { nextTitle='Quotation created'; nextCopy='Open the linked quotation to continue the sales process.'; }
  else if (hasPricing) { nextTitle='Review or continue pricing'; nextCopy='Pricing is available. Review it or convert it into a quotation.'; }

  const flowQuote = hasQuote ? `<button class="rfq-flow-step done" data-qid="${r.quotationId}" onclick="viewQuoteFromRFQ(this)" style="cursor:pointer"><i class="ti ti-check"></i>Quotation</button>` : `<span class="rfq-flow-step"><i class="ti ti-file-text"></i>Quotation</span>`;
  document.getElementById('rfq-view-body').innerHTML = `
    <div class="rfq-view-hero">
      <div><div class="rfq-view-id">${r.rfqNo}</div><div class="rfq-view-company">${r.company}</div><div class="rfq-view-ref">${r.ref ? 'Customer reference: '+r.ref : 'No customer reference provided'}</div></div>
      <div class="rfq-view-status-wrap"><span class="badge ${stClass}">${displayStatus}</span><div class="rfq-view-age">Received ${ageLabel}${overdue?' · due '+dueStr:''}</div></div>
    </div>
    <div class="rfq-view-grid">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="rfq-view-card rfq-section-info"><div class="rfq-view-card-title rfq-collapsible-title" role="button" tabindex="0" aria-expanded="true" onclick="toggleRFQDetailSection(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleRFQDetailSection(this)}"><i class="ti ti-building"></i>RFQ information<i class="ti ti-chevron-down rfq-section-chevron"></i></div><div class="rfq-card-content"><div class="rfq-view-info">
          <div class="detail-row"><span class="dk">Contact</span><span>${r.contact||'—'}</span></div><div class="detail-row"><span class="dk">Channel</span><span>${r.channel||'—'}</span></div>
          <div class="detail-row"><span class="dk">Received date</span><span>${fmtDate(r.date)}</span></div><div class="detail-row"><span class="dk">Response due</span><span style="${overdue?'color:var(--red);font-weight:700':''}">${dueStr||'—'}</span></div>
          <div class="detail-row"><span class="dk">Assigned to</span><span>${r.assigned||'—'}</span></div><div class="detail-row"><span class="dk">Current stage</span><span>${displayStatus}</span></div>
        </div></div></div>
        <div class="rfq-view-card rfq-items-card"><div class="rfq-view-card-title rfq-collapsible-title" role="button" tabindex="0" aria-expanded="true" onclick="toggleRFQDetailSection(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleRFQDetailSection(this)}"><i class="ti ti-list-details"></i>Required Items<i class="ti ti-chevron-down rfq-section-chevron"></i></div><div class="rfq-card-content">${itemsHtml}${reqItems.length&&r.desc?`<div class="rfq-requirement-note"><strong>General requirements</strong><p>${r.desc}</p></div>`:''}</div></div>
        <div class="rfq-view-card rfq-section-pricing"><div class="rfq-view-card-title rfq-collapsible-title" role="button" tabindex="0" aria-expanded="true" onclick="toggleRFQDetailSection(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleRFQDetailSection(this)}"><i class="ti ti-progress-check"></i>Pricing progress<i class="ti ti-chevron-down rfq-section-chevron"></i></div><div class="rfq-card-content">${pricingHtml}</div></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="rfq-view-card rfq-section-progress"><div class="rfq-next-action"><div class="rfq-next-action-label">Recommended next action</div><div class="rfq-next-action-title">${nextTitle}</div><div class="rfq-next-action-copy">${nextCopy}</div></div><div class="rfq-view-card-title" style="margin-top:2px"><i class="ti ti-route"></i>Document progress</div><div class="rfq-flow"><span class="rfq-flow-step done"><i class="ti ti-check"></i>RFQ</span><i class="ti ti-chevron-right rfq-flow-arrow"></i><span class="rfq-flow-step ${hasPricing?'done':(!isNoBid?'current':'')}"><i class="ti ti-calculator"></i>Pricing</span><i class="ti ti-chevron-right rfq-flow-arrow"></i>${flowQuote}</div>${isNoBid?`<div class="rfq-no-bid-box"><strong>No Bid reason:</strong> ${r.noBidReason||'Not specified'}${r.noBidNote?`<br><span>${r.noBidNote}</span>`:''}</div>`:''}</div>
        <div class="rfq-view-card rfq-section-attachment"><div class="rfq-view-card-title rfq-collapsible-title" role="button" tabindex="0" aria-expanded="true" onclick="toggleRFQDetailSection(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleRFQDetailSection(this)}"><i class="ti ti-paperclip"></i>Attachment<i class="ti ti-chevron-down rfq-section-chevron"></i></div><div class="rfq-card-content">${attachHtml}</div></div>
      </div>
    </div>`;

  const navActions=[]; const recordActions=[]; const dangerActions=[];
  navActions.push(navFromQuoteId
    ? '<button class="btn btn-secondary detail-action-close" onclick="backToQuoteFromRFQ()"><i class="ti ti-arrow-left"></i>Back to quotation</button>'
    : '<button class="btn btn-secondary detail-action-close" onclick="closeRFQView()"><i class="ti ti-x"></i>Close</button>');

  // Standard detail action order:
  // Edit -> state/workflow secondary actions -> primary workflow -> destructive action last.
  if (!isNoBid && !hasQuote) {
    recordActions.push(`<button class="btn btn-secondary" data-rid="${r.id}" onclick="editRFQFromView(this)"><i class="ti ti-edit"></i>Edit RFQ</button>`);
  }

  if (isNoBid) {
    recordActions.push(`<button class="btn btn-secondary" data-rid="${r.id}" onclick="reopenRFQFromBtn(this)"><i class="ti ti-refresh"></i>Reopen RFQ</button>`);
  } else if (!hasQuote) {
    recordActions.push(`<button class="btn btn-secondary" data-rid="${r.id}" onclick="openNoBidDialogFromBtn(this)"><i class="ti ti-circle-off"></i>Close as No Bid</button>`);
  }

  if (!isNoBid) {
    if (hasPricing) {
      recordActions.push(`<button class="btn btn-secondary" data-rid="${r.id}" onclick="viewPricingROFromBtn(this)"><i class="ti ti-eye"></i>View pricing</button>`);
      if (isPricingVersionLocked(r)) {
        recordActions.push(`<button class="btn btn-primary" data-rid="${r.id}" onclick="closeModal('rfq-view-modal');viewPricingReadOnly('${r.id}')"><i class="ti ti-git-branch"></i>Revise pricing</button>`);
      } else {
        recordActions.push(`<button class="btn btn-primary" data-rid="${r.id}" onclick="openPricingFromBtn(this)"><i class="ti ti-calculator"></i>Edit pricing</button>`);
      }
    } else {
      recordActions.push(`<button class="btn btn-primary" data-rid="${r.id}" onclick="openPricingFromBtn(this)"><i class="ti ti-calculator"></i>Start pricing</button>`);
    }

    if (hasQuote) {
      recordActions.push(`<button class="btn btn-success" data-qid="${r.quotationId}" onclick="viewQuoteFromRFQ(this)"><i class="ti ti-file-text"></i>Open quotation</button>`);
    }
  }

  if (canDelete) {
    dangerActions.push(`<button class="btn btn-quiet-danger detail-action-danger" data-rid="${r.id}" onclick="deleteRFQFromBtn(this)"><i class="ti ti-trash"></i>Delete</button>`);
  }

  document.getElementById('rfq-view-footer').innerHTML =
    `<div class="detail-action-footer-left rfq-view-footer-left">` +
      `${dangerActions.length?`<div class="detail-action-danger-group detail-action-danger-left">${dangerActions.join('')}</div>`:''}` +
    `</div>` +
    `<div class="detail-action-footer-center"><div class="detail-action-group">${recordActions.join('')}</div></div>` +
    `<div class="detail-action-footer-close">${navActions.join('')}</div>`;
  openModalWithSize('rfq-view-modal');
}

function editRFQ(id) {
  const r = rfqs.find(x=>x.id===id); if (!r) return;
  editingRFQId = id;
  rfqAttachment = r.attachment||null;
  document.getElementById('rfq-modal-title').textContent = 'Edit RFQ';
  document.getElementById('rfq-edit-no').textContent = r.rfqNo;
  document.getElementById('rfq-save-label').textContent = 'Update RFQ';
  setRFQFormState('saved');
  document.getElementById('rfq-cust-search').value = r.company;
  document.getElementById('rfq-cust-search').dataset.custId = r.custId||'';
  const editCustomer = customers.find(x=>x.id===r.custId);
  if (editCustomer) populateRFQContacts(editCustomer, r.contact||'');
  else {
    const contactSelect=document.getElementById('rfq-contact');
    contactSelect.innerHTML=`<option value="${r.contact||''}">${r.contact||'No contact selected'}</option>`;
    contactSelect.value=r.contact||'';
  }
  document.getElementById('rfq-channel').value = r.channel||'Email';
  document.getElementById('rfq-date').value = rfqISOToDisplay(r.date||'');
  document.getElementById('rfq-due').value = rfqISOToDisplay(r.due||'');
  const editDatePicker=document.getElementById('rfq-date-picker');if(editDatePicker)editDatePicker.value=r.date||'';
  const editDuePicker=document.getElementById('rfq-due-picker');if(editDuePicker)editDuePicker.value=r.due||'';
  populateRFQAssignees(r.assignedEmployeeId||r.assigned||'');
  document.getElementById('rfq-ref').value = r.ref||'';
  document.getElementById('rfq-desc').value = r.desc||'';
  document.getElementById('rfq-attach-list').innerHTML = rfqAttachment
    ? `<div class="attach-item"><i class="ti ti-paperclip"></i>${rfqAttachment.name}</div>` : '';
  openModalWithSize('rfq-modal');
  setupRFQEntryKeyboard();
}

/* ══════════════════════════════════════════════════
   PRICING SHEET
══════════════════════════════════════════════════ */
// Supplier dropdown in pricing
function openPricingSupDD() { filterPricingSupDD(); }
function closePricingSupDD() { document.getElementById('pricing-sup-dd').classList.remove('open'); }
function filterPricingSupDD() {
  const q = document.getElementById('pricing-sup-search').value.toLowerCase();
  const dd = document.getElementById('pricing-sup-dd');
  const matches = suppliers.filter(s=>!q||s.company.toLowerCase().includes(q));
  const supplierRows = matches.map(s=>`<div class="cust-option" onmousedown="selectPricingSupplier('${s.id}')"><div class="co-name">${s.company}</div><div class="co-sub">${s.contact||''} ${s.phone||''}</div></div>`).join('');
  const typedName = document.getElementById('pricing-sup-search').value.trim();
  dd.innerHTML = supplierRows
    + `<div class="cust-option add-new" onmousedown="quickAddSupplierFromPricing();return false"><i class="ti ti-plus" style="margin-right:5px"></i>Add new supplier${typedName ? ' — '+typedName : ''}</div>`;
  dd.classList.add('open');
}
function selectPricingSupplier(id) {
  const s = suppliers.find(x=>x.id===id); if (!s) return;
  document.getElementById('pricing-sup-search').value = s.company;
  document.getElementById('pricing-sup-search').dataset.supplierId = s.id;
  pricingSupplierName = s.company;
  closePricingSupDD();
}

function quickAddSupplierFromPricing() {
  quickAddContext = 'pricing_supplier';
  const typedName = document.getElementById('pricing-sup-search').value.trim();
  const body = document.querySelector('#pricing-modal .modal-body');
  if (body) body._savedScroll = body.scrollTop;
  editingSupId = null;
  document.getElementById('sup-modal-title').textContent = 'Add new supplier';
  resetSupplierPartyFields(typedName);
  document.getElementById('sup-modal').style.zIndex = '220';
  closePricingSupDD();
  openModalWithSize('sup-modal');
  setTimeout(()=>document.getElementById(typedName?'sm-contact':'sm-company')?.focus(),50);
}

function renderPricingVendorQuotes() {
  const box = document.getElementById('pricing-attach-list');
  if (!box) return;
  if (!pricingVendorQuotes.length) {
    box.innerHTML = '<div style="font-size:11px;color:var(--gray);padding:4px 0">No vendor quotations attached.</div>';
    return;
  }
  box.innerHTML = pricingVendorQuotes.map((q,i)=>`
    <div class="attach-item" style="margin-top:6px;gap:8px">
      <i class="ti ti-${q.type?.includes('pdf')?'file-type-pdf':'photo'}" style="color:var(--blue)"></i>
      <div style="min-width:0;flex:1">
        <div style="font-size:12px;font-weight:600;color:var(--blue);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${q.supplier||'Unspecified supplier'} <span style="font-weight:400;color:var(--gray)">${q.ref?'· '+q.ref:''}</span></div>
        <a href="${q.url||q.data}" download="${q.name}" target="_blank" rel="noopener" style="font-size:11px;color:var(--gray);text-decoration:none">${q.name}</a>
      </div>
      <button type="button" class="abtn abtn-del" onclick="removePricingVendorQuote(${i})" title="Remove attachment"><i class="ti ti-trash"></i></button>
    </div>`).join('');
}

function handlePricingAttach(e) {
  const file = e.target.files[0]; if (!file) return;
  if (file.size > 10*1024*1024) { showToast('Attachment must be under 10MB','error'); e.target.value=''; return; }
  const supplier = document.getElementById('pricing-sup-search').value.trim() || pricingSupplierName;
  const ref = document.getElementById('pricing-sup-ref').value.trim();
  const date = getPricingSupplierDateISO();
  const localPreview = URL.createObjectURL(file); // instant preview, no base64 needed
  const entry = {id:'vq'+Date.now(), supplier, ref, date, name:file.name, type:file.type, data:localPreview};
  pricingVendorQuotes.push(entry);
  renderPricingVendorQuotes();
  markPricingDirty();

  if (window.FB) {
    const path = 'pricing/' + (pricingRFQId || ('new-'+Date.now().toString(36))) + '/' + entry.id + '_' + file.name;
    entry._uploadPromise = window.FB.uploadFile(path, file).then(url => {
      if (url) {
        URL.revokeObjectURL(localPreview);
        delete entry.data; entry.url = url; entry.path = path; entry._uploadFailed = false;
      } else {
        entry._uploadFailed = true;
        showToast('Attachment upload failed — please try again before saving','error');
      }
      renderPricingVendorQuotes();
      return url;
    });
  }
  e.target.value='';
}

function removePricingVendorQuote(index) {
  const entry = pricingVendorQuotes[index];
  if (entry?.path && window.FB) window.FB.deleteFile(entry.path);
  pricingVendorQuotes.splice(index,1);
  renderPricingVendorQuotes();
  markPricingDirty();
}

function applyPrimarySupplierToPricingLines(mode='blank') {
  const supplier = document.getElementById('pricing-sup-search').value.trim() || pricingSupplierName;
  const ref = document.getElementById('pricing-sup-ref').value.trim();
  if (!supplier && !ref) { showToast('Enter a primary supplier or quotation reference first','error'); return; }
  document.querySelectorAll('#pricing-tbody tr').forEach(tr=>{
    const s = tr.querySelector('[data-role="supplier"]');
    const r = tr.querySelector('[data-role="supref"]');
    if (s && (mode==='all' || !s.value.trim())) s.value = supplier;
    if (r && (mode==='all' || !r.value.trim())) r.value = ref;
  });
  markPricingDirty();
  showToast(mode==='all'?'Primary supplier applied to all lines':'Primary supplier applied to blank lines','success');
}

function addPricingRow(item={}) {
  const tbody = document.getElementById('pricing-tbody');
  const n = tbody.querySelectorAll('tr:not(.pricing-quick-add-row)').length+1;
  const primarySupplier = document.getElementById('pricing-sup-search')?.value.trim() || pricingSupplierName || '';
  const primaryRef = document.getElementById('pricing-sup-ref')?.value.trim() || '';
  const rowSupplier = item.supplierName ?? item.supplier ?? primarySupplier;
  const rowSupRef = item.supRef ?? item.supplierRef ?? primaryRef;
  const supplierOptions = ['<option value=""></option>'].concat(suppliers.map(s=>`<option value="${String(s.company).replace(/"/g,'&quot;')}">${s.company}</option>`)).join('');
  const tr = document.createElement('tr');
  tr.dataset.lineId = item.lineId || ('pricing-line-' + Date.now() + '-' + Math.random().toString(36).slice(2,8));
  tr.dataset.sortOrder = String(Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : n);
  tr.dataset.productId = item.productId || item.itemId || '';
  tr.innerHTML = `
    <td class="pricing-drag-cell"><div tabindex="-1" class="pricing-drag-handle" draggable="true"
      ondragstart="startPricingRowDrag(event,this)" ondragend="endPricingRowDrag(event)"
      title="Drag to reorder line" aria-label="Drag to reorder line" role="button"><span aria-hidden="true">⋮⋮</span></div></td>
    <td class="pricing-line-number" style="text-align:center;color:var(--gray);font-size:12px">${n}</td>
    <td><input data-role="code" placeholder="Code" value="${item.code||''}" style="font-size:12px"></td>
    <td class="pricing-item-cell"><input data-role="desc" class="pricing-line-item-search" placeholder="Search or enter item description" value="${item.desc||''}" autocomplete="off" onfocus="openPricingLineItemSearch(this)" oninput="filterPricingLineItemSearch(this)" onkeydown="handlePricingLineItemKeydown(event,this)" onblur="setTimeout(closePricingLineItemSearch,180)" style="width:100%"></td>
    <td><input data-role="qty" type="text" inputmode="decimal" value="${formatQuantity(item.qty||1)}" onfocus="beginQuantityEdit(this)" oninput="calcPricingRow(this)" onblur="endQuantityEdit(this)" style="text-align:right"></td>
    <td><input data-role="uom" placeholder="Pcs" value="${item.uom||'Pcs'}"></td>
    <td><select data-role="supplier" style="width:100%;min-width:140px;height:30px;border:1px solid var(--border);border-radius:4px;font-size:13px;padding:0 7px">${supplierOptions}</select></td>
    <td><input data-role="supref" placeholder="Quote ref." value="${rowSupRef||''}" style="font-size:12px"></td>
    <td><input data-role="buy" type="text" inputmode="decimal" value="${item.buy!==undefined&&item.buy!==''?formatNumber(item.buy,pricingDecimals()):''}" onfocus="beginPriceEdit(this)" oninput="calcPricingRow(this)" onblur="endPriceEdit(this)" placeholder="${(0).toFixed(pricingDecimals())}" style="text-align:right"></td>
    <td><input data-role="markup" type="number" min="0" step="0.1" value="${item.markup!==undefined&&item.markup!==''?item.markup:Number(activePricingSettings().targetMargin||0).toFixed(1)}" oninput="calcFromMarkup(this)" placeholder="%" style="text-align:right;background:#fffbf0"></td>
    <td><input data-role="sell" type="text" inputmode="decimal" value="${item.sell!==undefined&&item.sell!==''?formatNumber(item.sell,pricingDecimals()):''}" onfocus="beginPriceEdit(this)" oninput="calcFromSell(this)" onblur="endPriceEdit(this)" placeholder="${(0).toFixed(pricingDecimals())}" style="text-align:right;font-weight:650"></td>
    <td class="margin-cell">—</td>
    <td class="margin-cell">—</td>
    <td><div class="pricing-row-actions">
      <button type="button" tabindex="-1" class="del-btn" onclick="removePricingRow(this)" title="Remove row" aria-label="Remove row"><i class="ti ti-trash"></i></button>
    </div></td>`;
  tr.addEventListener('dragover', handlePricingRowDragOver);
  tr.addEventListener('dragleave', clearPricingRowDragOver);
  tr.addEventListener('drop', dropPricingRow);
  tr.addEventListener('keydown', handlePricingRowKeyboardMove);
  const quickRow = tbody.querySelector('.pricing-quick-add-row');
  if (quickRow) tbody.insertBefore(tr, quickRow); else tbody.appendChild(tr);
  tr.querySelector('[data-role="supplier"]').value = rowSupplier || '';
  if (item.buy || item.sell) calcPricingRow(tr.querySelector('[data-role="qty"]'));
  ensurePricingQuickAddRow();
  renumberPricingRows();
  return tr;
}

function ensurePricingQuickAddRow() {
  const tbody = document.getElementById('pricing-tbody');
  if (!tbody) return;
  tbody.querySelectorAll('.pricing-quick-add-row').forEach(tr=>tr.remove());
  const tr = document.createElement('tr');
  tr.className = 'pricing-quick-add-row';
  tr.innerHTML = `
    <td class="pricing-drag-cell"></td>
    <td style="text-align:center">+</td>
    <td colspan="4">
      <div class="pricing-quick-add-wrap">
        <i class="ti ti-search pricing-quick-add-icon"></i>
        <input id="pricing-prod-search" placeholder="Select Item…" autocomplete="off"
          oninput="filterPricingProdSearch()" onfocus="openPricingProdSearch()" onblur="setTimeout(closePricingProdSearch,200)">
        <div id="pricing-prod-dd"></div>
      </div>
    </td>
    <td colspan="7" style="color:#64748b;font-size:12px">Search by item name, code, description, brand or category.</td>
    <td><button type="button" class="btn btn-secondary btn-sm" onclick="quickAddProductFromPricing()" title="Create new item"><i class="ti ti-plus"></i></button></td>`;
  tbody.appendChild(tr);
}

function renumberPricingRows() {
  const rows=[...document.querySelectorAll('#pricing-tbody tr:not(.pricing-quick-add-row)')];
  rows.forEach((tr,index)=>{
    const sortOrder=index+1;
    tr.dataset.sortOrder=String(sortOrder);
    const numberCell=tr.querySelector('.pricing-line-number');
    if(numberCell) numberCell.textContent=sortOrder;
  });
}

function capturePricingFocus(row) {
  const active=document.activeElement;
  if(!row || !active || !row.contains(active) || !active.matches('input,select,textarea')) return null;
  return {
    role: active.dataset.role || '',
    selectionStart: typeof active.selectionStart==='number' ? active.selectionStart : null,
    selectionEnd: typeof active.selectionEnd==='number' ? active.selectionEnd : null
  };
}

function restorePricingFocus(row, focusState) {
  if(!row || !focusState) return;
  const field=focusState.role ? row.querySelector('[data-role="'+focusState.role+'"]') : null;
  if(!field) return;
  field.focus({preventScroll:true});
  if(focusState.selectionStart!==null && typeof field.setSelectionRange==='function') {
    try { field.setSelectionRange(focusState.selectionStart,focusState.selectionEnd); } catch(_) {}
  }
  row.scrollIntoView({block:'nearest'});
}

function movePricingRowElement(row,targetIndex,focusState=null) {
  const tbody=document.getElementById('pricing-tbody');
  if(!row||!tbody||row.classList.contains('pricing-quick-add-row')) return false;
  const rows=[...tbody.querySelectorAll('tr:not(.pricing-quick-add-row)')];
  const fromIndex=rows.indexOf(row);
  targetIndex=Math.max(0,Math.min(targetIndex,rows.length-1));
  if(fromIndex<0||fromIndex===targetIndex) return false;
  const without=rows.filter(r=>r!==row);
  const anchor=without[targetIndex] || tbody.querySelector('.pricing-quick-add-row');
  if(anchor) tbody.insertBefore(row,anchor); else tbody.appendChild(row);
  renumberPricingRows();
  restorePricingFocus(row,focusState);
  return true;
}

function queuePricingDraftAutoSave(wasDirtyBeforeReorder=false) {
  if(!pricingDraftSaveTimer) pricingReorderHadPriorDirty=!!wasDirtyBeforeReorder;
  clearTimeout(pricingDraftSaveTimer);
  const sequence=++pricingDraftSaveSequence;
  pricingDraftSaveTimer=setTimeout(()=>autoSavePricingDraftAfterReorder(pricingReorderHadPriorDirty,sequence),250);
}

function readPricingItemsFromDOM() {
  const items=[];
  document.querySelectorAll('#pricing-tbody tr:not(.pricing-quick-add-row)').forEach((tr,index)=>{
    const code=tr.querySelector('[data-role="code"]')?.value.trim()||'';
    const desc=tr.querySelector('[data-role="desc"]')?.value.trim()||'';
    const qty=parsePricingNumber(tr.querySelector('[data-role="qty"]')?.value);
    const uom=tr.querySelector('[data-role="uom"]')?.value||'Pcs';
    const supplierName=tr.querySelector('[data-role="supplier"]')?.value.trim()||'';
    const supRef=tr.querySelector('[data-role="supref"]')?.value.trim()||'';
    const buy=parsePricingNumber(tr.querySelector('[data-role="buy"]')?.value);
    const markup=parseFloat(tr.querySelector('[data-role="markup"]')?.value)||0;
    const sell=parsePricingNumber(tr.querySelector('[data-role="sell"]')?.value);
    const sortOrder=index+1;
    tr.dataset.sortOrder=String(sortOrder);
    if(desc||buy||code){const lineSupplier=findUniqueMasterByName(suppliers,supplierName);items.push({lineId:tr.dataset.lineId,productId:tr.dataset.productId||'',sortOrder,code,desc,qty,uom,supplierName,supplierId:lineSupplier?.id||'',supRef,buy,markup,sell});}
  });
  return items;
}

async function autoSavePricingDraftAfterReorder(wasDirtyBeforeReorder,sequence) {
  if(sequence!==pricingDraftSaveSequence) return;
  pricingDraftSaveTimer=null;
  pricingReorderHadPriorDirty=false;
  const r=rfqs.find(x=>x.id===pricingRFQId); if(!r) return;
  const items=readPricingItemsFromDOM();
  r.pricingItems=items;
  const versions=ensurePricingVersions(r);
  let version=getCurrentPricingVersion(r);
  if(!version){version={version:r.currentPricingVersion||1,created:new Date().toISOString()};versions.push(version);}
  version.status=version.status==='Revision Draft'?'Revision Draft':'Saved';
  version.updated=new Date().toISOString();
  version.pricingItems=JSON.parse(JSON.stringify(items));
  await saveRFQs();
  if(wasDirtyBeforeReorder) {
    markPricingDirty();
    const note=document.getElementById('pricing-save-note');
    if(note) note.textContent='Draft auto-saved after reordering. Other unsaved changes still require review.';
  } else {
    setPricingSavedState(true);
    const note=document.getElementById('pricing-save-note');
    if(note) note.textContent='Line order auto-saved. Ready to convert.';
  }
}

function completePricingReorder(row,focusState,wasDirtyBeforeReorder) {
  renumberPricingRows();
  restorePricingFocus(row,focusState);
  markPricingDirty();
  queuePricingDraftAutoSave(wasDirtyBeforeReorder);
}

function handlePricingRowKeyboardMove(event) {
  if(!event.altKey || (event.key!=='ArrowUp' && event.key!=='ArrowDown')) return;
  const row=event.currentTarget;
  const rows=[...document.querySelectorAll('#pricing-tbody tr:not(.pricing-quick-add-row)')];
  const index=rows.indexOf(row);
  const targetIndex=index+(event.key==='ArrowUp'?-1:1);
  if(index<0||targetIndex<0||targetIndex>=rows.length) return;
  event.preventDefault();
  event.stopPropagation();
  const focusState=capturePricingFocus(row);
  const wasDirtyBeforeReorder=pricingDirty;
  if(movePricingRowElement(row,targetIndex,focusState)) completePricingReorder(row,focusState,wasDirtyBeforeReorder);
}

function startPricingRowDrag(event,handle) {
  const row=handle.closest('tr'); if(!row) return;
  pricingDragRow=row;
  pricingDragFocus=capturePricingFocus(row);
  row.classList.add('pricing-row-dragging');
  event.dataTransfer.effectAllowed='move';
  event.dataTransfer.setData('text/plain',row.dataset.lineId||'pricing-row');
}

function handlePricingRowDragOver(event) {
  if(!pricingDragRow || pricingDragRow===event.currentTarget) return;
  event.preventDefault();
  event.dataTransfer.dropEffect='move';
  event.currentTarget.classList.add('pricing-row-drag-over');
}

function clearPricingRowDragOver(event) {
  if(!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.classList.remove('pricing-row-drag-over');
}

function dropPricingRow(event) {
  if(!pricingDragRow) return;
  event.preventDefault();
  const target=event.currentTarget;
  document.querySelectorAll('#pricing-tbody .pricing-row-drag-over').forEach(r=>r.classList.remove('pricing-row-drag-over'));
  if(target===pricingDragRow) return;
  const rows=[...document.querySelectorAll('#pricing-tbody tr:not(.pricing-quick-add-row)')];
  const fromIndex=rows.indexOf(pricingDragRow), targetIndex=rows.indexOf(target);
  if(fromIndex<0||targetIndex<0) return;
  const rect=target.getBoundingClientRect();
  let insertionIndex=targetIndex+(event.clientY>rect.top+rect.height/2?1:0);
  if(fromIndex<insertionIndex) insertionIndex--;
  const wasDirtyBeforeReorder=pricingDirty;
  if(movePricingRowElement(pricingDragRow,insertionIndex,pricingDragFocus)) completePricingReorder(pricingDragRow,pricingDragFocus,wasDirtyBeforeReorder);
}

function endPricingRowDrag() {
  document.querySelectorAll('#pricing-tbody .pricing-row-dragging,#pricing-tbody .pricing-row-drag-over').forEach(r=>r.classList.remove('pricing-row-dragging','pricing-row-drag-over'));
  pricingDragRow=null;
  pricingDragFocus=null;
}

function removePricingRow(btn) {
  btn.closest('tr')?.remove();
  ensurePricingQuickAddRow();
  renumberPricingRows();
  markPricingDirty();
  calcPricingSummary();
}


/* ── EXISTING PRICING LINE ITEM SEARCH / REPLACEMENT ── */
let pricingLineItemSearchInput = null;
let pricingLineItemSearchIndex = -1;

function pricingLineItemSearchDropdown() {
  let dd = document.getElementById('pricing-line-item-dd');
  if (!dd) {
    dd = document.createElement('div');
    dd.id = 'pricing-line-item-dd';
    dd.className = 'pricing-line-item-dd';
    document.body.appendChild(dd);
  }
  return dd;
}

function positionPricingLineItemSearch(input) {
  const dd = pricingLineItemSearchDropdown();
  if (!input || !dd) return;
  const r = input.getBoundingClientRect();
  const width = Math.max(360, Math.min(560, Math.max(r.width, 420)));
  dd.style.width = width + 'px';
  dd.style.left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) + 'px';
  const estimated = Math.min(300, dd.scrollHeight || 260);
  if (window.innerHeight - r.bottom < estimated + 8 && r.top > estimated) {
    dd.style.top = 'auto';
    dd.style.bottom = (window.innerHeight - r.top + 2) + 'px';
  } else {
    dd.style.bottom = 'auto';
    dd.style.top = (r.bottom + 2) + 'px';
  }
}

function openPricingLineItemSearch(input) {
  pricingLineItemSearchInput = input;
  pricingLineItemSearchIndex = -1;
  filterPricingLineItemSearch(input);
}

function closePricingLineItemSearch() {
  const dd = document.getElementById('pricing-line-item-dd');
  if (dd) dd.style.display = 'none';
  pricingLineItemSearchIndex = -1;
}

function pricingLineItemMatches(query) {
  const q = String(query || '').trim().toLowerCase();
  return products.filter(p => !q || `${p.name||''} ${p.code||''} ${p.brand||''} ${p.model||''} ${p.category||''} ${p.notes||''}`.toLowerCase().includes(q)).slice(0,15);
}

function filterPricingLineItemSearch(input) {
  pricingLineItemSearchInput = input;
  const tr = input.closest('tr');
  if (!input.value.trim()) {
    // Clearing the selected item resets the complete business content of this line.
    // Keep only the permanent line identity and sort order for database-safe editing.
    tr.dataset.productId = '';
    ['code','qty','uom','supref','buy','markup','sell'].forEach(role => {
      const field = tr.querySelector('[data-role="' + role + '"]');
      if (field) field.value = '';
    });
    const supplier = tr.querySelector('[data-role="supplier"]');
    if (supplier) supplier.value = '';
    tr.querySelectorAll('.margin-cell').forEach(cell => cell.textContent = '—');
    calcPricingSummary();
  }
  pricingLineItemSearchIndex = -1;
  const dd = pricingLineItemSearchDropdown();
  const matches = pricingLineItemMatches(input.value);
  dd.innerHTML = matches.map(p => `
    <div class="pricing-line-item-option" data-product-id="${p.id}" onmousedown="selectPricingLineItem('${p.id}');return false">
      <div class="pricing-line-item-option-main">${p.name || 'Unnamed item'}</div>
      <div class="pricing-line-item-option-meta">${[p.code,p.brand,p.category,p.uom].filter(Boolean).join(' · ') || 'Item master'}</div>
    </div>`).join('') + (matches.length ? '' : '<div class="pricing-line-item-empty">No matching items found.</div>') +
    `<div class="pricing-line-item-create" onmousedown="quickAddProductFromPricing();return false"><i class="ti ti-plus"></i> Create new item${input.value.trim() ? ' — ' + input.value.trim() : ''}</div>`;
  dd.style.display = 'block';
  positionPricingLineItemSearch(input);
  markPricingDirty();
}

function selectPricingLineItem(productId) {
  const input = pricingLineItemSearchInput;
  const tr = input?.closest('tr');
  const p = products.find(x => x.id === productId);
  if (!tr || !p) return;
  tr.dataset.productId = p.id || '';
  const code = tr.querySelector('[data-role="code"]');
  const desc = tr.querySelector('[data-role="desc"]');
  const uom = tr.querySelector('[data-role="uom"]');
  if (code) code.value = p.code || '';
  if (desc) desc.value = p.name || '';
  if (uom) uom.value = p.uom || 'Pcs';
  const qty = tr.querySelector('[data-role="qty"]');
  const buy = tr.querySelector('[data-role="buy"]');
  const markup = tr.querySelector('[data-role="markup"]');
  const sell = tr.querySelector('[data-role="sell"]');
  if (qty) qty.value = formatQuantity(1);
  if (buy) buy.value = '';
  if (markup) markup.value = Number(activePricingSettings().targetMargin || 0).toFixed(1);
  if (sell) sell.value = p.price > 0 ? formatNumber(p.price, pricingDecimals()) : '';
  closePricingLineItemSearch();
  markPricingDirty();
  if (sell?.value) calcFromSell(sell); else calcPricingSummary();
  if (qty) setTimeout(() => { qty.focus(); qty.select(); }, 20);
}

function pricingLineItemVisibleOptions() {
  return [...document.querySelectorAll('#pricing-line-item-dd .pricing-line-item-option')].filter(x => x.offsetParent !== null);
}

function highlightPricingLineItemOption(index) {
  const opts = pricingLineItemVisibleOptions();
  opts.forEach(x => x.classList.remove('active'));
  if (!opts.length) { pricingLineItemSearchIndex = -1; return null; }
  pricingLineItemSearchIndex = Math.max(0, Math.min(index, opts.length - 1));
  const opt = opts[pricingLineItemSearchIndex];
  opt.classList.add('active');
  opt.scrollIntoView({block:'nearest'});
  return opt;
}

function handlePricingLineItemKeydown(event,input) {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    event.stopPropagation();
    const dd = document.getElementById('pricing-line-item-dd');
    const isOpen = dd?.style.display === 'block' && pricingLineItemSearchInput === input;
    if (!isOpen) openPricingLineItemSearch(input);
    highlightPricingLineItemOption(pricingLineItemSearchIndex < 0 ? 0 : pricingLineItemSearchIndex + 1);
    return;
  }
  if (event.key === 'ArrowUp') {
    const dd = document.getElementById('pricing-line-item-dd');
    if (dd?.style.display === 'block' && pricingLineItemSearchInput === input) {
      event.preventDefault();
      event.stopPropagation();
      highlightPricingLineItemOption(pricingLineItemSearchIndex < 0 ? pricingLineItemVisibleOptions().length - 1 : pricingLineItemSearchIndex - 1);
    }
    return;
  }
  if (event.key === 'Enter') {
    const dd = document.getElementById('pricing-line-item-dd');
    if (dd?.style.display === 'block') {
      event.preventDefault();
      const opt = highlightPricingLineItemOption(pricingLineItemSearchIndex < 0 ? 0 : pricingLineItemSearchIndex);
      if (opt?.dataset.productId) selectPricingLineItem(opt.dataset.productId);
    }
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    closePricingLineItemSearch();
    input.focus({preventScroll:true});
  }
}

window.addEventListener('resize', () => {
  if (pricingLineItemSearchInput && document.getElementById('pricing-line-item-dd')?.style.display === 'block') positionPricingLineItemSearch(pricingLineItemSearchInput);
});
window.addEventListener('scroll', () => {
  if (pricingLineItemSearchInput && document.getElementById('pricing-line-item-dd')?.style.display === 'block') positionPricingLineItemSearch(pricingLineItemSearchInput);
}, true);

/* ── PRODUCT SEARCH IN PRICING ── */
function positionPricingProdDD() {
  const input=document.getElementById('pricing-prod-search'), dd=document.getElementById('pricing-prod-dd');
  if(!input||!dd) return;
  const r=input.getBoundingClientRect();
  const width=Math.max(360,Math.min(560,r.width));
  dd.style.width=width+'px';
  dd.style.left=Math.max(8,Math.min(r.left,window.innerWidth-width-8))+'px';
  const estimated=Math.min(260,dd.scrollHeight||260);
  const below=window.innerHeight-r.bottom;
  if(below<estimated+8 && r.top>estimated){dd.style.top='auto';dd.style.bottom=(window.innerHeight-r.top)+'px';dd.style.borderRadius='var(--radius) var(--radius) 0 0';}
  else{dd.style.bottom='auto';dd.style.top=r.bottom+'px';dd.style.borderRadius='0 0 var(--radius) var(--radius)';}
}
function openPricingProdSearch() { filterPricingProdSearch(); positionPricingProdDD(); }
function closePricingProdSearch() { const dd=document.getElementById('pricing-prod-dd'); if(dd) dd.style.display='none'; }
function filterPricingProdSearch() {
  const q = (document.getElementById('pricing-prod-search')?.value||'').toLowerCase();
  const dd = document.getElementById('pricing-prod-dd'); if (!dd) return;
  const matches = products.filter(p => !q || `${p.name} ${p.brand} ${p.model} ${p.code} ${p.category}`.toLowerCase().includes(q)).slice(0,15);
  const resultRows = matches.map(p => {
    const imgHtml = p.image
      ? `<img src="${p.image}" style="width:32px;height:32px;object-fit:contain;border-radius:3px;border:1px solid var(--border);flex-shrink:0">`
      : `<div style="width:32px;height:32px;background:var(--blue-pale);border-radius:3px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="ti ti-package" style="font-size:14px;color:var(--blue-light)"></i></div>`;
    return `<div class="pricing-prod-option" data-product-id="${p.id}" onmousedown="addProductToPricing('${p.id}')"
      style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center">
      ${imgHtml}
      <div style="flex:1;min-width:0">
        <div style="font-weight:500;font-size:12px;color:var(--blue)">${p.name}</div>
        <div style="font-size:11px;color:var(--gray)">${[p.code,p.brand,p.category].filter(Boolean).join(' · ')}</div>
        ${p.price>0?`<div style="font-size:11px;color:var(--green)">List price: ${fmt(p.price)}</div>`:''}
      </div>
    </div>`;
  }).join('');
  const emptyMessage = matches.length ? '' : `<div style="padding:10px 12px;font-size:12px;color:var(--gray)">No matching items found.</div>`;
  dd.innerHTML = resultRows + emptyMessage + `<div class="cust-option add-new" onmousedown="quickAddProductFromPricing();return false"><i class="ti ti-plus" style="margin-right:5px"></i>Create new item${q ? ' — '+(document.getElementById('pricing-prod-search')?.value||'').trim() : ''}</div>`;
  dd.style.display = 'block';
  positionPricingProdDD();
}

function addProductToPricing(pid) {
  const p = products.find(x=>x.id===pid); if (!p) return;
  const quickSearch = document.getElementById('pricing-prod-search');
  if (quickSearch) quickSearch.value = '';
  closePricingProdSearch();
  // Add row with product details — buy price empty (user enters cost), sell = list price as suggestion
  const addedRow = addPricingRow({code:p.code||'', desc:p.name, qty:1, uom:p.uom||'Pcs', buy:'', sell:p.price||''});
  // Start line entry at quantity; the item search remains the only way to create rows.
  const qtyInput = addedRow?.querySelector('[data-role="qty"]');
  if (qtyInput) setTimeout(()=>{ qtyInput.focus(); qtyInput.select(); },50);
}

function quickAddProductFromPricing() {
  // Save pricing state first, then open product modal
  quickAddContext = 'product_pricing';
  editingProdId = null;
  document.getElementById('prod-modal-title').textContent = 'Add new product';
  ['pm-name','pm-code','pm-brand','pm-model','pm-notes'].forEach(id => document.getElementById(id).value='');
  document.getElementById('pm-cat').value='';
  document.getElementById('pm-cat-add').style.display='none';
  document.getElementById('pm-uom').value='Pcs';
  document.getElementById('pm-price').value='';
  document.getElementById('specs-list').innerHTML='';
  clearProductImage();
  loadCustomCategoriesIntoForm();
  addSpecRow(); addSpecRow();
  document.getElementById('prod-modal').style.zIndex='200';
  openModalWithSize('prod-modal');
}

function parsePricingNumber(value) {
  return parseFloat(String(value ?? '').replace(/,/g,'').trim()) || 0;
}
function beginQuantityEdit(input) {
  input.value = String(input.value || '').replace(/,/g,'');
  input.select();
}
function endQuantityEdit(input) {
  const value = parsePricingNumber(input.value);
  input.value = value ? formatQuantity(value) : '';
  calcPricingRow(input);
}
function beginPriceEdit(input) {
  input.value = String(input.value || '').replace(/,/g,'');
  input.select();
}
function endPriceEdit(input) {
  const value = parsePricingNumber(input.value);
  input.value = value || value === 0 ? formatNumber(value,2) : '';
  if (input.dataset.role === 'sell') calcFromSell(input); else calcPricingRow(input);
}

function getRowNums(input) {
  const tr = input.closest('tr');
  return {
    tr,
    qty:  parsePricingNumber(tr.querySelector('[data-role="qty"]')?.value),
    buy:  parsePricingNumber(tr.querySelector('[data-role="buy"]')?.value),
    markup: parseFloat(tr.querySelector('[data-role="markup"]')?.value)||0,
    sell: parsePricingNumber(tr.querySelector('[data-role="sell"]')?.value)
  };
}

function calcPricingRow(input) {
  const {tr,qty,buy,sell}=getRowNums(input);
  const pctInput=tr.querySelector('[data-role="markup"]');
  if(!buy&&!sell){updateMarginCells(tr,0,0);calcPricingSummary();return;}
  if(buy && !sell && pctInput && pctInput.value===''){
    pctInput.value=Number(activePricingSettings().targetMargin||0).toFixed(1);
    const si=tr.querySelector('[data-role="sell"]'); if(si)si.value=formatNumber(sellingFromPricingPercent(buy,pctInput.value),pricingDecimals());
  }
  const currentSell=parsePricingNumber(tr.querySelector('[data-role="sell"]')?.value);
  const pct=pricingPercent(buy,currentSell), margin=(currentSell-buy)*qty;
  if(pctInput && currentSell) pctInput.value=pct.toFixed(1);
  updateMarginCells(tr,margin,pct);calcPricingSummary();
}

function calcFromMarkup(input) {
  const {tr,qty,buy,markup}=getRowNums(input); if(!buy)return;
  const sell=sellingFromPricingPercent(buy,markup), sellInput=tr.querySelector('[data-role="sell"]');
  if(sellInput)sellInput.value=formatNumber(sell,pricingDecimals());
  updateMarginCells(tr,(sell-buy)*qty,pricingPercent(buy,sell));calcPricingSummary();
}

function calcFromSell(input) {
  const {tr,qty,buy,sell}=getRowNums(input); if(!buy||!sell){calcPricingRow(input);return;}
  const pct=pricingPercent(buy,sell), pctInput=tr.querySelector('[data-role="markup"]');
  if(pctInput)pctInput.value=pct.toFixed(1);
  updateMarginCells(tr,(sell-buy)*qty,pct);calcPricingSummary();
}

function updateMarginCells(tr,margin,pct) {
  const cells=tr.querySelectorAll('.margin-cell'),status=getMarginStatusForPercent(pct),cls=pct<0?'neg':pct<Number(activePricingSettings().minMargin||0)?'low':'good';
  if(cells[0]){cells[0].textContent=pricingFmt(margin);cells[0].className='margin-cell '+cls;if(status)cells[0].style.color=status.color;}
  if(cells[1]){cells[1].textContent=pct.toFixed(1)+'%';cells[1].className='margin-cell '+cls;if(status)cells[1].style.color=status.color;}
}

function updatePricingActionButtons() {
  const saveBtn=document.getElementById('pricing-save-btn');
  const convertBtn=document.getElementById('pricing-convert-btn');
  const r=rfqs.find(x=>x.id===pricingRFQId);
  const isRevision=Number(r?.currentPricingVersion||1)>1;
  if(saveBtn){
    saveBtn.disabled=pricingSaveInProgress||pricingConvertInProgress;
    saveBtn.innerHTML=pricingSaveInProgress
      ? '<i class="ti ti-loader-2 pricing-btn-spinner"></i>Saving…'
      : '<i class="ti ti-device-floppy"></i>Save';
  }
  if(convertBtn){
    convertBtn.disabled=pricingSaveInProgress||pricingConvertInProgress;
    if(pricingConvertInProgress) convertBtn.innerHTML='<i class="ti ti-loader-2 pricing-btn-spinner"></i>Converting…';
    else if(!pricingSaved||pricingDirty) convertBtn.innerHTML='<i class="ti ti-file-arrow-right"></i>Save &amp; '+(isRevision?'create revision':'convert');
    else convertBtn.innerHTML='<i class="ti ti-file-arrow-right"></i>'+(isRevision?'Create quotation revision':'Convert to quotation');
  }
}

function markPricingDirty() {
  pricingDirty = true;
  pricingSaved = false;
  const note = document.getElementById('pricing-save-note');
  if (note) note.textContent = 'Unsaved changes — Save & Convert will save them first.';
  updatePricingActionButtons();
}

function setPricingSavedState(saved) {
  pricingSaved = !!saved;
  pricingDirty = !saved;
  const note = document.getElementById('pricing-save-note');
  if (note) note.textContent = saved ? 'Pricing saved. Ready to convert.' : 'Pricing has not been saved yet.';
  updatePricingActionButtons();
}

function setAdditionalCostsExpanded(expanded) {
  const section=document.getElementById('internal-costs-section');
  const btn=document.getElementById('internal-costs-toggle');
  if(!section)return;
  section.classList.toggle('is-open',!!expanded);
  if(btn)btn.innerHTML=expanded?'<i class="ti ti-chevron-up"></i>Collapse':'<i class="ti ti-adjustments"></i>Manage';
}

function toggleAdditionalCosts() {
  const section=document.getElementById('internal-costs-section');
  setAdditionalCostsExpanded(!(section&&section.classList.contains('is-open')));
}

function getCostNameOptions(selected='') {
  const appliedCostComponents=readStoredCostComponents();
  const names=[...new Set([...appliedCostComponents.map(c=>c.name),'Other'])];
  if(selected&&!names.includes(selected))names.unshift(selected);
  return '<option value="">Select cost type</option>'+names.map(n=>`<option value="${escapeHtml(n)}" ${n===selected?'selected':''}>${escapeHtml(n)}</option>`).join('');
}
function addAdditionalCostRow(cost={}, expandEditor=false) {
  const tbody=document.getElementById('internal-costs-tbody');if(!tbody)return;
  if(expandEditor)setAdditionalCostsExpanded(true);
  const locked=cost.locked===true;
  const tr=document.createElement('tr');
  tr.dataset.masterId=cost.masterId||'';tr.dataset.locked=locked?'true':'false';tr.dataset.seq=String(cost.seq||999);
  tr.innerHTML=`<td><select data-cost-role="name" ${locked?'disabled':''}>${getCostNameOptions(cost.name||'')}</select></td>
    <td><select data-cost-role="method" ${locked?'disabled':''}>
      <option value="fixed">Fixed amount</option><option value="material_pct">% of material cost</option>
      <option value="total_cost_pct">% of total cost</option><option value="sales_pct">% of total selling</option>
    </select></td>
    <td><input data-cost-role="value" type="number" min="0" step="0.01" value="${Number(cost.value)||0}" ${locked?'disabled':''}></td>
    <td class="internal-cost-amount" data-cost-role="amount">SAR 0.00</td>
    <td>${locked?'<span title="Locked by Cost Components Master" style="color:#64748b"><i class="ti ti-lock"></i></span>':'<button type="button" class="row-del" title="Remove cost" onclick="this.closest(\'tr\').remove();markPricingDirty();calcPricingSummary()">×</button>'}</td>`;
  tbody.appendChild(tr);
  const method=tr.querySelector('[data-cost-role="method"]');if(method)method.value=cost.method||'fixed';
  tr.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',()=>{markPricingDirty();calcPricingSummary();}));
  if(expandEditor)markPricingDirty();
}
function addInternalCostRow(cost={}){addAdditionalCostRow(cost);}
function ensureDefaultAdditionalCosts(existingCosts=[]) {
  const saved=Array.isArray(existingCosts)?existingCosts:[];
  const defaults=saved.length?saved:(activePricingSettings().includeCosts?getEnabledMasterPricingCosts():[]);
  defaults.sort((a,b)=>(Number(a.seq)||999)-(Number(b.seq)||999)).forEach(c=>addAdditionalCostRow(c));
}
function readInternalCosts(materialCost,totalSell) {
  const costs=[];let total=0;let runningTotalCost=materialCost;
  document.querySelectorAll('#internal-costs-tbody tr').forEach((tr,index)=>{
    const name=tr.querySelector('[data-cost-role="name"]')?.value.trim()||'';
    const method=tr.querySelector('[data-cost-role="method"]')?.value||'fixed';
    const value=parseFloat(tr.querySelector('[data-cost-role="value"]')?.value)||0;
    let amount=0;
    if(method==='material_pct')amount=materialCost*value/100;
    else if(method==='total_cost_pct')amount=runningTotalCost*value/100;
    else if(method==='sales_pct')amount=totalSell*value/100;
    else amount=value;
    amount=Math.max(0,amount||0);total+=amount;runningTotalCost+=amount;
    const cell=tr.querySelector('[data-cost-role="amount"]');if(cell)cell.textContent=pricingFmt(amount);
    if(name||value)costs.push({masterId:tr.dataset.masterId||undefined,seq:Number(tr.dataset.seq)||index+1,name,method,value,amount,locked:tr.dataset.locked==='true',fromMaster:!!tr.dataset.masterId});
  });
  return {costs,total};
}

function setTargetPricingMargin(targetPct) {
  targetPct=Number.isFinite(Number(targetPct))?Number(targetPct):Number(activePricingSettings().targetMargin||0);
  let materialCost=0; const rows=[...document.querySelectorAll('#pricing-tbody tr:not(.pricing-quick-add-row)')];
  rows.forEach(tr=>{materialCost+=parsePricingNumber(tr.querySelector('[data-role="qty"]')?.value)*parsePricingNumber(tr.querySelector('[data-role="buy"]')?.value);});
  if(!materialCost){showToast('Enter buy prices before setting a target margin','error');return;}
  let fixed=0,materialPct=0,salesPct=0,totalCostFactor=1;
  document.querySelectorAll('#internal-costs-tbody tr').forEach(tr=>{const m=tr.querySelector('[data-cost-role="method"]')?.value||'fixed',v=parseFloat(tr.querySelector('[data-cost-role="value"]')?.value)||0;if(m==='fixed')fixed+=v;else if(m==='material_pct')materialPct+=v;else if(m==='total_cost_pct')totalCostFactor*=1+v/100;else if(m==='sales_pct')salesPct+=v;});
  const baseCost=(materialCost*(1+materialPct/100)+fixed)*totalCostFactor;
  let targetSell;
  if(activePricingSettings().marginMethod==='gross_margin'){
    const denom=1-targetPct/100-salesPct/100; if(denom<=0){showToast('Target margin and sales-based costs are too high.','error');return;} targetSell=baseCost/denom;
  }else{
    const factor=1+targetPct/100,denom=1-factor*salesPct/100;if(denom<=0){showToast('Sales-based internal cost is too high for this target.','error');return;}targetSell=baseCost*factor/denom;
  }
  targetSell=pricingRound(targetSell); const factor=targetSell/materialCost;
  rows.forEach(tr=>{const buy=parsePricingNumber(tr.querySelector('[data-role="buy"]')?.value);if(!buy)return;const sell=pricingRound(buy*factor),si=tr.querySelector('[data-role="sell"]'),pi=tr.querySelector('[data-role="markup"]');if(si)si.value=formatNumber(sell,pricingDecimals());if(pi)pi.value=pricingPercent(buy,sell).toFixed(1);calcPricingRow(si||tr);});
  markPricingDirty();calcPricingSummary();
}

function initMarginGaugeDrag() {
  const gauge=document.getElementById('margin-gauge'); if(!gauge||gauge.dataset.bound)return; gauge.dataset.bound='1';
  const apply=e=>{const r=gauge.getBoundingClientRect();const y=Math.max(0,Math.min(r.height,e.clientY-r.top));setTargetPricingMargin(((r.height-y)/r.height)*100);};
  gauge.addEventListener('pointerdown',e=>{gauge.setPointerCapture(e.pointerId);gauge.classList.add('is-dragging');apply(e);});
  gauge.addEventListener('pointermove',e=>{if(gauge.hasPointerCapture(e.pointerId))apply(e);});
  gauge.addEventListener('pointerup',e=>{gauge.classList.remove('is-dragging');try{gauge.releasePointerCapture(e.pointerId)}catch(_){}});
}

function calcPricingSummary() {
  let totalCost=0, totalSell=0;
  document.querySelectorAll('#pricing-tbody tr').forEach(tr => {
    const qty  = parsePricingNumber(tr.querySelector('[data-role="qty"]')?.value);
    const buy  = parsePricingNumber(tr.querySelector('[data-role="buy"]')?.value);
    const sell = parsePricingNumber(tr.querySelector('[data-role="sell"]')?.value);
    totalCost += buy*qty;
    totalSell += sell*qty;
  });
  const internal = readInternalCosts(totalCost,totalSell);
  pricingInternalCosts = internal.costs;
  const activeCostCount=internal.costs.filter(c=>Number(c.amount)>0 || c.method==='zakat_auto' || Number(c.value)>0).length;
  const costCountEl=document.getElementById('internal-costs-count');
  const costTotalEl=document.getElementById('internal-costs-total');
  if(costCountEl)costCountEl.textContent=activeCostCount ? activeCostCount+' '+(activeCostCount===1?'item':'items') : 'None added';
  if(costTotalEl)costTotalEl.textContent=pricingFmt(internal.total);
  const profitabilityCost = totalCost + internal.total;
  const margin = totalSell-profitabilityCost;
  const pct = pricingPercent(profitabilityCost,totalSell);
  document.getElementById('ps-cost').textContent = pricingFmt(totalCost);
  document.getElementById('ps-additional-cost').textContent = pricingFmt(internal.total);
  document.getElementById('ps-total-cost').textContent = pricingFmt(profitabilityCost);
  document.getElementById('ps-sell').textContent = pricingFmt(totalSell);
  document.getElementById('ps-margin').textContent = pricingFmt(margin);
  document.getElementById('ps-pct').textContent    = pct.toFixed(1)+'%';
  // Color coding
  const colorClass = pct>=20?'green':'';
  document.getElementById('ps-margin').className = 'ps-val '+colorClass;
  document.getElementById('ps-pct').className    = 'ps-val '+colorClass;
  // Margin gauge: 0–100% scale, with values outside the range pinned to the nearest end
  const gaugePct = Math.max(0, Math.min(100, pct));
  const gaugeMarker = document.getElementById('margin-gauge-marker');
  const gaugeValue = document.getElementById('margin-gauge-value');
  if (gaugeMarker) gaugeMarker.style.bottom = gaugePct.toFixed(1)+'%';
  if (gaugeValue) gaugeValue.textContent = pct.toFixed(1)+'%';
  // Administrator-managed Margin Status integrated into the Summary panel
  const statusCard = document.getElementById('pricing-margin-status-card');
  const statusLabel = document.getElementById('ps-status-label');
  const statusDetail = document.getElementById('ps-status-detail');
  const statusCurrent = document.getElementById('ps-status-current');
  const statusRange = document.getElementById('ps-status-range');
  const statusApproval = document.getElementById('ps-status-approval');
  const statusDot = document.getElementById('ps-status-dot');
  const statusIcon = document.getElementById('ps-status-icon');
  const gaugeMarkerIcon = document.getElementById('margin-gauge-marker-icon');
  updateMarginGaugeScale();
  if (statusCard && statusLabel && statusDetail && totalCost>0) {
    const status=getMarginStatusForPercent(pct);
    if(status){
      statusCard.className='pricing-margin-status-card';
      statusCard.style.display='block';
      statusCard.style.borderColor=status.color;
      statusCard.style.background=status.color+'12';
      statusLabel.textContent=status.name;
      statusLabel.style.color=status.color;
      if(statusIcon){statusIcon.textContent=status.icon||'●';statusIcon.style.color=status.color;}
      if(gaugeMarkerIcon)gaugeMarkerIcon.textContent=status.icon||'';
      if(statusDot){statusDot.style.background=status.color;statusDot.style.boxShadow=`0 0 0 4px ${status.color}1A`;}
      const ps=activePricingSettings();
      if(statusCurrent) statusCurrent.textContent='Current margin: '+pct.toFixed(1)+'%';
      if(statusRange) statusRange.textContent='Range: '+Number(status.from).toFixed(1)+'% to '+Number(status.to).toFixed(1)+'%';
      if(statusApproval){
        const belowMinimum=pct<Number(ps.minMargin||0);
        statusApproval.textContent=belowMinimum?(ps.managerApproval?'Manager approval required':'Below minimum margin'):'\u00a0';
        statusApproval.classList.toggle('is-empty',!belowMinimum);
      }
    }else{
      statusCard.style.display='block';statusCard.style.borderColor='#64748b';statusCard.style.background='#64748b12';statusLabel.textContent='Unclassified';statusLabel.style.color='#64748b';if(statusIcon){statusIcon.textContent='?';statusIcon.style.color='#64748b';}if(gaugeMarkerIcon)gaugeMarkerIcon.textContent='';if(statusDot){statusDot.style.background='#64748b';statusDot.style.boxShadow='0 0 0 4px rgba(100,116,139,.10)';}if(statusCurrent) statusCurrent.textContent='Current margin: '+pct.toFixed(1)+'%';if(statusRange) statusRange.textContent='No active range configured';if(statusApproval){statusApproval.textContent='\u00a0';statusApproval.classList.add('is-empty');}
    }
  } else if (statusCard) statusCard.style.display='none';
}


function confirmClearPricingRows() {
  const rowCount = document.querySelectorAll('#pricing-tbody tr:not(.pricing-quick-add-row)').length;
  if (!rowCount) {
    showToast('There are no pricing rows to clear','error');
    return;
  }
  showConfirm({
    icon: '🗑️',
    title: 'Clear all pricing rows?',
    message: 'This will remove every item currently entered in this pricing sheet. This action cannot be undone unless the pricing was previously saved.',
    details: {'Rows to remove': rowCount},
    confirmText: 'Clear all rows',
    cancelText: 'Keep rows',
    confirmClass: 'btn-danger',
    onConfirm: () => {
      document.getElementById('pricing-tbody').innerHTML='';
      ensurePricingQuickAddRow();
      markPricingDirty();
      calcPricingSummary();
      showToast('All pricing rows cleared','success');
    }
  });
}

function validatePricingPrices() {
  const rows = [...document.querySelectorAll('#pricing-tbody tr')];
  for (let i=0; i<rows.length; i++) {
    const tr = rows[i];
    const desc = tr.querySelector('[data-role="desc"]')?.value.trim() || '';
    const buyInput = tr.querySelector('[data-role="buy"]');
    const sellInput = tr.querySelector('[data-role="sell"]');
    const buyRaw = String(buyInput?.value ?? '').trim();
    const sellRaw = String(sellInput?.value ?? '').trim();
    const rowHasData = desc || buyRaw || sellRaw || (tr.querySelector('[data-role="code"]')?.value.trim() || '');
    if (!rowHasData) continue;

    if (!buyRaw || !(parseFloat(buyRaw) > 0)) {
      const id = 'pricing-buy-required-' + i;
      if (buyInput) buyInput.id = id;
      showValidationDialog(
        'Buy price required',
        'Enter a valid buy price greater than zero for pricing line ' + (i+1) + '.',
        id,
        'Buy price is required'
      );
      return false;
    }
    if (!sellRaw || !(parseFloat(sellRaw) > 0)) {
      const id = 'pricing-sell-required-' + i;
      if (sellInput) sellInput.id = id;
      showValidationDialog(
        'Sell price required',
        'Enter a valid sell price greater than zero for pricing line ' + (i+1) + '.',
        id,
        'Sell price is required'
      );
      return false;
    }
  }
  return true;
}

let pricingSummaryManualState = null;
function applyPricingSummaryPanelState() {
  const workspace=document.querySelector('#pricing-modal .pricing-workspace');
  const btn=document.getElementById('pricing-summary-toggle');
  if(!workspace||!btn) return;
  const autoCompact=window.innerWidth<=1450 && window.innerWidth>820;
  const compact=window.innerWidth<=820 ? false : (pricingSummaryManualState===null ? autoCompact : pricingSummaryManualState);
  workspace.classList.toggle('summary-compact',compact);
  workspace.classList.toggle('summary-expanded',!compact && pricingSummaryManualState===false);
  btn.innerHTML=compact?'<i class="ti ti-layout-sidebar-right-expand"></i>':'<i class="ti ti-layout-sidebar-right-collapse"></i>';
  btn.title=compact?'Expand summary':'Collapse summary';
}
function togglePricingSummaryPanel() {
  const workspace=document.querySelector('#pricing-modal .pricing-workspace');
  const currentlyCompact=workspace?.classList.contains('summary-compact') || (window.innerWidth<=1450 && !workspace?.classList.contains('summary-expanded'));
  pricingSummaryManualState=!currentlyCompact;
  applyPricingSummaryPanelState();
}
window.addEventListener('resize',()=>{ if(document.getElementById('pricing-modal')?.classList.contains('active')) applyPricingSummaryPanelState(); closePricingProdSearch(); });


function pricingLocalISODate(date=new Date()) {
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,'0');
  const d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function pricingISOToDisplay(value='') {
  const m=String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}
function pricingDisplayToISO(value='') {
  const m=String(value).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(!m)return '';
  const d=Number(m[1]), mo=Number(m[2]), y=Number(m[3]);
  const dt=new Date(y,mo-1,d,12,0,0,0);
  if(dt.getFullYear()!==y || dt.getMonth()!==mo-1 || dt.getDate()!==d)return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}
function formatPricingDateInput(el) {
  const digits=el.value.replace(/\D/g,'').slice(0,8);
  let out=digits.slice(0,2);
  if(digits.length>2)out+='/'+digits.slice(2,4);
  if(digits.length>4)out+='/'+digits.slice(4,8);
  el.value=out;
}
function pricingSupplierDateBounds() {
  const today=new Date();
  today.setHours(12,0,0,0);
  const oldest=new Date(today);
  oldest.setMonth(oldest.getMonth()-6);
  return { min:pricingLocalISODate(oldest), max:pricingLocalISODate(today) };
}
function applyPricingSupplierDateRules({defaultToday=false}={}) {
  const el=document.getElementById('pricing-sup-date');
  if(!el)return;
  const bounds=pricingSupplierDateBounds();
  if(defaultToday && !el.value) el.value=pricingISOToDisplay(bounds.max);
  if(!el.dataset.dateRulesBound){
    el.dataset.dateRulesBound='1';
    el.addEventListener('input',()=>formatPricingDateInput(el));
    el.addEventListener('keydown',(e)=>{
      if((e.key==='Backspace' || e.key==='Delete') && el.selectionStart===el.selectionEnd){
        const pos=el.selectionStart;
        if(e.key==='Backspace' && (pos===3 || pos===6)){
          e.preventDefault(); el.setSelectionRange(pos-1,pos-1);
        }else if(e.key==='Delete' && (pos===2 || pos===5)){
          e.preventDefault(); el.setSelectionRange(pos+1,pos+1);
        }
      }
    });
    el.addEventListener('blur',()=>validatePricingSupplierDate({silentEmpty:true}));
  }
}
function getPricingSupplierDateISO(){
  const el=document.getElementById('pricing-sup-date');
  return el ? pricingDisplayToISO(el.value) : '';
}
function validatePricingSupplierDate({silentEmpty=false}={}) {
  const el=document.getElementById('pricing-sup-date');
  if(!el || !el.value)return true;
  const iso=pricingDisplayToISO(el.value);
  let message='';
  if(!iso) message='Enter the quotation date as DD/MM/YYYY.';
  else {
    const bounds=pricingSupplierDateBounds();
    if(iso>bounds.max) message='Future quotation dates are not allowed.';
    else if(iso<bounds.min) message='Quotation date cannot be more than six months old.';
  }
  if(!message){
    el.classList.remove('pricing-required-invalid');
    el.setAttribute('aria-invalid','false');
    return true;
  }
  el.classList.add('pricing-required-invalid');
  el.setAttribute('aria-invalid','true');
  if(!silentEmpty || el.value) showToast(message,'error','Invalid quotation date');
  return false;
}

async function openPricingSheet(rfqId,{closeSource=true}={}) {
  clearTimeout(pricingDraftSaveTimer);
  pricingDraftSaveTimer=null;
  pricingReorderHadPriorDirty=false;
  if(closeSource) closeModal('rfq-view-modal');
  pricingSummaryManualState = null;
  pricingRFQId = rfqId;
  pricingAttachment = null;
  pricingVendorQuotes = [];
  pricingSupplierName = '';
  pricingInternalCosts = [];
  const r = rfqs.find(x=>x.id===rfqId); if (!r) return;
  ensurePricingVersions(r);
  const activeVersion=getCurrentPricingVersion(r);
  if (activeVersion) syncRFQFromPricingVersion(r,activeVersion);
  if (isPricingVersionLocked(r)) {
    viewPricingReadOnly(rfqId);
    showToast('Converted pricing is locked. Use Revise Pricing to create a new version.','info');
    return;
  }
  // Auto-advance status to Pricing when opened
  if (r.status === 'New') {
    r.status = 'Pricing';
    await saveRFQs();
    renderRFQPage();
  }
  document.getElementById('pricing-modal-title').textContent = 'Pricing V'+(r.currentPricingVersion||1)+' — '+r.rfqNo+' / '+r.company;
  // RFQ info bar
  document.getElementById('pricing-rfq-info').innerHTML = `
    <span><strong>Customer:</strong> ${r.company}</span>
    <span><strong>Ref:</strong> ${r.ref||'—'}</span>
    <span><strong>Due:</strong> ${fmtDate(r.due)}</span>
    <span style="color:var(--gray)">${r.desc||''}</span>`;
  // Supplier
  document.getElementById('pricing-sup-search').value = r.supplierName||'';
  document.getElementById('pricing-sup-search').dataset.supplierId = r.supplierId || findUniqueMasterByName(suppliers,r.supplierName)?.id || '';
  pricingSupplierName = r.supplierName||'';
  document.getElementById('pricing-sup-ref').value = r.supRef||'';
  document.getElementById('pricing-sup-date').value = pricingISOToDisplay(r.supDate||'');
  applyPricingSupplierDateRules({defaultToday:!r.supDate});
  const pricingNotesEl=document.getElementById('pricing-internal-notes');
  if(pricingNotesEl){ pricingNotesEl.value=r.internalNotes||''; const count=document.getElementById('pricing-internal-notes-count'); if(count) count.textContent=pricingNotesEl.value.length+' / 2000'; }
  // Vendor quotation attachments (supports legacy single attachment)
  pricingVendorQuotes = Array.isArray(r.vendorQuotes) ? [...r.vendorQuotes] : [];
  if (!pricingVendorQuotes.length && r.pricingAttachment) {
    pricingVendorQuotes.push({id:'legacy-vq', supplier:r.supplierName||'', ref:r.supRef||'', date:r.supDate||'', ...r.pricingAttachment});
  }
  renderPricingVendorQuotes();
  // Items
  document.getElementById('pricing-tbody').innerHTML='';
  document.getElementById('internal-costs-tbody').innerHTML='';
  setAdditionalCostsExpanded(false);
  ensureDefaultAdditionalCosts(r.internalCosts||[]);
  [...(r.pricingItems||[])]
    .map((it,index)=>({...it,sortOrder:Number.isFinite(Number(it.sortOrder))?Number(it.sortOrder):index+1}))
    .sort((a,b)=>a.sortOrder-b.sortOrder)
    .forEach(it=>addPricingRow(it));
  ensurePricingQuickAddRow();
  calcPricingSummary();
  setPricingSavedState(!!(r.pricingItems&&r.pricingItems.length));
  updatePricingActionButtons();
  initMarginGaugeDrag(); updatePricingSettingsRuntimeUI();
  const pm=document.getElementById('pricing-modal'); if(pm&&!pm.dataset.dirtyBound){pm.dataset.dirtyBound='1';pm.addEventListener('input',e=>{if(e.target.matches('input,select,textarea')&&!e.target.closest('#internal-costs-tbody'))markPricingDirty();});}
  // Update back button based on navigation context
  const backBtnEl = document.getElementById('pricing-back-btn');
  if (backBtnEl) {
    if (navFromQuoteId) {
      backBtnEl.innerHTML = '<button class="btn btn-secondary" onclick="backToQuoteFromPricing()"><i class="ti ti-arrow-left"></i>Back to quotation</button>';
    }
  }
  openModalWithSize('pricing-modal');
  requestAnimationFrame(applyPricingSummaryPanelState);
}

function validatePricingHeaderFields() {
  const fields = [
    { id:'pricing-sup-search', label:'Supplier name' },
    { id:'pricing-sup-ref', label:'Supplier quotation reference' },
    { id:'pricing-sup-date', label:'Supplier quotation date' }
  ];
  const missing = fields.filter(f => !document.getElementById(f.id)?.value.trim());

  fields.forEach(f => {
    const el=document.getElementById(f.id);
    if(!el)return;
    el.classList.toggle('pricing-required-invalid', missing.some(m=>m.id===f.id));
    el.setAttribute('aria-invalid', missing.some(m=>m.id===f.id) ? 'true' : 'false');
  });

  if(!missing.length)return validatePricingSupplierDate();

  const first=document.getElementById(missing[0].id);
  showConfirm({
    icon:'⚠️',
    title:'Complete supplier quotation details',
    message:'Enter the required information before saving this pricing document.',
    details:Object.fromEntries(missing.map((f,i)=>['Required '+(i+1),f.label])),
    confirmText:'Enter details',
    cancelText:'Continue editing',
    confirmClass:'btn-primary',
    onConfirm:()=>{
      first?.scrollIntoView({behavior:'smooth',block:'center'});
      setTimeout(()=>first?.focus(),180);
    },
    onCancel:()=>{
      first?.scrollIntoView({behavior:'smooth',block:'center'});
      setTimeout(()=>first?.focus(),100);
    }
  });
  return false;
}

async function requestSavePricing() {
  if(pricingSaveInProgress||pricingConvertInProgress)return false;
  if(!validatePricingHeaderFields())return false;
  if(!validatePricingPrices())return false;
  const rule=checkPricingBusinessRules(true);if(!rule.ok)return false;
  if(rule.needsApproval&&!obtainPricingManagerApproval())return false;
  const rowCount=[...document.querySelectorAll('#pricing-tbody tr')].filter(tr=>tr.querySelector('[data-role="desc"]')?.value.trim()).length;
  const ok=await new Promise(resolve=>showConfirm({icon:'💾',title:'Save pricing?',message:'Please confirm that supplier prices, selling prices and additional costs have been reviewed.',details:{'Pricing lines':rowCount,'Additional cost lines':document.querySelectorAll('#internal-costs-tbody tr').length,'Currency':pricingCurrency(),'Margin method':pricingMethodLabel(),'Overall margin':rule.metrics.pct.toFixed(1)+'%'},confirmText:'Save pricing',cancelText:'Continue editing',confirmClass:'btn-primary',onConfirm:()=>resolve(true),onCancel:()=>resolve(false)}));
  if(!ok)return false;
  pricingSaveInProgress=true;updatePricingActionButtons();
  try{return await savePricing();}
  finally{pricingSaveInProgress=false;updatePricingActionButtons();}
}

async function savePricing() {
  clearTimeout(pricingDraftSaveTimer);
  pricingDraftSaveTimer=null;
  pricingReorderHadPriorDirty=false;
  const r = rfqs.find(x=>x.id===pricingRFQId); if (!r) return false;
  if (!validatePricingHeaderFields()) return false;
  if (!validatePricingPrices()) return false;
  const pendingUploads = pricingVendorQuotes.filter(q=>q._uploadPromise);
  if (pendingUploads.length) { showToast('Finishing attachment upload…','success'); await Promise.all(pendingUploads.map(q=>q._uploadPromise)); pendingUploads.forEach(q=>delete q._uploadPromise); }
  if (pricingVendorQuotes.some(q=>q._uploadFailed)) { showValidationDialog('Attachment upload failed','One or more vendor quote attachments could not be uploaded. Check your connection and try attaching them again, or remove the failed one(s) and save without them.',document.getElementById('pricing-attach-list')); return false; }
  showBusyOverlay('pricing-modal', 'Saving pricing…');
  try {
  const items=readPricingItemsFromDOM();
  r.pricingItems = items; r.pricingSettingsSnapshot={...activePricingSettings()}; const _ruleSnapshot=checkPricingBusinessRules(false); r.pricingApprovalRequired=!!_ruleSnapshot.needsApproval; r.pricingApproved=!_ruleSnapshot.needsApproval||pricingManagerApprovedForCurrentSave; pricingManagerApprovedForCurrentSave=false;
  r.supplierName = document.getElementById('pricing-sup-search').value.trim()||pricingSupplierName;
  const selectedPricingSupplier=findUniqueMasterByName(suppliers,r.supplierName);
  r.supplierId = document.getElementById('pricing-sup-search').dataset.supplierId || selectedPricingSupplier?.id || '';
  r.supRef       = document.getElementById('pricing-sup-ref').value.trim();
  r.supDate      = getPricingSupplierDateISO();
  r.internalNotes = document.getElementById('pricing-internal-notes')?.value.trim()||'';
  const materialCost = items.reduce((sum,i)=>sum+(Number(i.buy)||0)*(Number(i.qty)||0),0);
  const totalSell = items.reduce((sum,i)=>sum+(Number(i.sell)||0)*(Number(i.qty)||0),0);
  r.internalCosts = readInternalCosts(materialCost,totalSell).costs;
  r.vendorQuotes = pricingVendorQuotes;
  r.pricingAttachment = pricingVendorQuotes[0] || null; // legacy compatibility
  const versions=ensurePricingVersions(r);
  let version=getCurrentPricingVersion(r);
  if(!version){version={version:r.currentPricingVersion||1,created:new Date().toISOString()};versions.push(version);}
  version.status = version.status==='Revision Draft' ? 'Revision Draft' : 'Saved';
  version.updated = new Date().toISOString();
  version.supplierName=r.supplierName; version.supplierId=r.supplierId||''; version.supRef=r.supRef; version.supDate=r.supDate; version.internalNotes=r.internalNotes||'';
  version.pricingItems=JSON.parse(JSON.stringify(r.pricingItems||[]));
  version.internalCosts=JSON.parse(JSON.stringify(r.internalCosts||[]));
  version.vendorQuotes=JSON.parse(JSON.stringify(r.vendorQuotes||[]));
  version.pricingAttachment=r.pricingAttachment||null;
  if (r.status==='New') r.status='Pricing';
  await saveRFQs();
  setPricingSavedState(true);
  // Synchronize the global safe-close/autosave system with the successful Pricing save.
  if(typeof window.bizcoreFormSaved==='function') window.bizcoreFormSaved('pricing-modal');
  document.querySelectorAll('#pricing-sup-search,#pricing-sup-ref,#pricing-sup-date').forEach(el=>{
    el.classList.remove('pricing-required-invalid');
    el.setAttribute('aria-invalid','false');
  });
  // Show above the full-screen Pricing modal after persistence and confirmation cleanup.
  setTimeout(()=>showToast('Pricing saved successfully.','success','Saved'),80);
  return true;
  } finally { hideBusyOverlay('pricing-modal'); }
}

async function convertToQuotation() {
  if(pricingConvertInProgress||pricingSaveInProgress)return;
  if(!validatePricingPrices())return;
  const liveRule=checkPricingBusinessRules(true); if(!liveRule.ok)return; if(liveRule.needsApproval && !obtainPricingManagerApproval())return;
  pricingConvertInProgress=true;updatePricingActionButtons();
  try {
    // Transaction-safe workflow: persist the latest pricing and sortOrder before creating a quotation draft.
    if(!pricingSaved||pricingDirty){
      const saved=await savePricing();
      if(!saved)return;
    }
  const r = rfqs.find(x=>x.id===pricingRFQId); if (!r) return;
  if (!r.pricingItems?.length) { showToast('Add at least one item to the pricing sheet','error'); return; }
  // Calculate totals for confirm dialog
  const totalCost = r.pricingItems.reduce((s,i)=>(s+(parseFloat(i.buy)||0)*(parseFloat(i.qty)||0)),0);
  const totalSell = r.pricingItems.reduce((s,i)=>(s+(parseFloat(i.sell)||0)*(parseFloat(i.qty)||0)),0);
  const internalTotal=(r.internalCosts||[]).reduce((sum,c)=>sum+(Number(c.amount)||0),0);
  const profitabilityCost=totalCost+internalTotal;
  const margin = totalSell - profitabilityCost;
  const marginPct = pricingPercent(profitabilityCost,totalSell).toFixed(1);
  const pricingVatRate=(Number(activePricingSettings().vat)||0)/100; const vatAmt=Math.round(totalSell*pricingVatRate*Math.pow(10,pricingDecimals()))/Math.pow(10,pricingDecimals());
  const confirmed = await new Promise(resolve => {
    showConfirm({
      icon: '📄',
      title: 'Convert pricing to quotation?',
      message: 'This will create a new quotation with the sell prices from this pricing sheet. Please review before proceeding.',
      details: {
        'RFQ': r.rfqNo,
        'Customer': r.company,
        'Items': r.pricingItems.length + ' line item(s)',
        'Material cost': pricingFmt(totalCost),
        'Additional Cost': pricingFmt(internalTotal),
        'Total sell (ex-VAT)': pricingFmt(totalSell),
        ['VAT ('+Number(activePricingSettings().vat||0).toFixed(2).replace(/\.00$/,'')+'%)']: pricingFmt(vatAmt),
        'Net amount': pricingFmt(totalSell + vatAmt),
        'Overall margin': pricingFmt(margin) + ' (' + marginPct + '%)'
      },
      confirmText: '✓ Convert to quotation',
      cancelText: '← Back to pricing',
      confirmClass: 'btn-success',
      onConfirm: () => resolve(true),
      onCancel:  () => resolve(false)
    });
  });
  if (!confirmed) return;
  closeModal('pricing-modal');
  // Pre-fill quotation form from RFQ + pricing
  editingId = null;
  document.getElementById('modal-title').textContent = 'New quotation — from '+r.rfqNo;
  // Customer
  const cust = customers.find(x=>x.id===r.custId) || customers.find(x=>x.company===r.company);
  if (cust) {
    selectedCustId = cust.id;
    document.getElementById('f-cust-search').value = cust.company;
    document.getElementById('f-cust-search').classList.add('cust-locked');
    document.getElementById('f-company').value = cust.company;
    document.getElementById('f-city').value = cust.city||'';
  }
  document.getElementById('f-contact').value = r.contact||'';
  document.getElementById('f-ref').value = r.ref||'';
  const activePricingVersion=getCurrentPricingVersion(r);
  const isRevision=Number(activePricingVersion?.version||1)>1 || !!r.quotationId;
  const revisionInfo=isRevision ? nextQuotationRevisionNo(r) : null;
  document.getElementById('f-qno').value = 'Auto on Save';
  document.getElementById('f-qno').dataset.reservedQno = '';
  document.getElementById('f-qno').dataset.isProvisional = '0';
  document.getElementById('f-date').value = todayQuoteDateDisplay();
  document.getElementById('f-status').value = 'Draft';
  document.getElementById('f-validity').value = Math.max(1,Number(activePricingSettings().validity)||7);
  document.getElementById('f-notes').value = r.desc||'';
  populateTermsSelect('delivery');
  populateTermsSelect('payment');
  document.getElementById('f-discount').value='0';
  // Items — from pricing, use sell prices
  currentQuoteType='product'; setQuoteType('product');
  document.getElementById('items-tbody').innerHTML='';
  const pricingRef='PR-'+String(r.rfqNo||pricingRFQId||'').replace(/^RFQ-?/i,'')+'-V'+Number(activePricingVersion?.version||r.currentPricingVersion||1);
  const pricingCost=r.pricingItems.reduce((s,it)=>s+(Number(it.buy)||0)*(Number(it.qty)||0),0);
  r.pricingItems.forEach(it=>{
    addItemRow({desc:it.desc, qty:it.qty, uom:it.uom||'Pcs', up:it.sell, pricingSell:it.sell, pricingBuy:it.buy, code:'', brand:'', model:'', specs:''});
  });
  setQuotationPricingContext({rfqNo:r.rfqNo,pricingRef,cost:pricingCost,version:Number(activePricingVersion?.version||r.currentPricingVersion||1)});
  calcTotals();
  // Link RFQ
  document._pendingRFQId = pricingRFQId;
  document._pendingPricingVersion = Number(activePricingVersion?.version||r.currentPricingVersion||1);
  document._pendingQuotationRevision = revisionInfo ? {
    ...revisionInfo,
    rfqId:pricingRFQId,
    sourceQuotationId:r.quotationId||revisionInfo.revisionOf||null
  } : null;
  openModalWithSize('quote-modal');
  showToast('Pricing saved and transferred — review and save the quotation','success');
  } finally {
    pricingConvertInProgress=false;
    updatePricingActionButtons();
  }
}

let validationTargetField = null;
let validationCleanupHandler = null;

function clearFieldValidation(field) {
  if (!field) return;
  field.classList.remove('validation-error-field');
  const group = field.closest('.form-group');
  const label = group ? group.querySelector('label') : null;
  if (label) label.classList.remove('validation-error-label');
  if (group) {
    const hint = group.querySelector('.validation-error-text');
    if (hint) hint.remove();
  }
}

function markFieldInvalid(field, message='Required') {
  if (!field) return;
  clearFieldValidation(field);
  field.classList.add('validation-error-field');
  const group = field.closest('.form-group');
  const label = group ? group.querySelector('label') : null;
  if (label) label.classList.add('validation-error-label');
  if (group) {
    const hint = document.createElement('span');
    hint.className = 'validation-error-text';
    hint.textContent = message;
    group.appendChild(hint);
  }
  const clearWhenValid = () => {
    const value = String(field.value ?? '').trim();
    if (value) {
      clearFieldValidation(field);
      field.removeEventListener('input', clearWhenValid);
      field.removeEventListener('change', clearWhenValid);
      if (validationCleanupHandler === clearWhenValid) validationCleanupHandler = null;
    }
  };
  validationCleanupHandler = clearWhenValid;
  field.addEventListener('input', clearWhenValid);
  field.addEventListener('change', clearWhenValid);
}

function showValidationDialog(title, message, targetFieldId, fieldMessage='Required') {
  const dialog = document.getElementById('validation-dialog');
  const titleEl = document.getElementById('validation-dialog-title');
  const messageEl = document.getElementById('validation-dialog-message');
  validationTargetField = targetFieldId ? document.getElementById(targetFieldId) : null;
  if (titleEl) titleEl.textContent = title || 'Validation Required';
  if (messageEl) messageEl.textContent = message || 'Please complete the required field.';
  if (validationTargetField) markFieldInvalid(validationTargetField, fieldMessage);
  if (dialog) dialog.classList.add('open');
  setTimeout(()=>document.getElementById('validation-dialog-ok')?.focus(), 30);
}

function closeValidationDialog() {
  const dialog = document.getElementById('validation-dialog');
  if (dialog) dialog.classList.remove('open');
  const field = validationTargetField;
  validationTargetField = null;
  if (field) {
    setTimeout(() => {
      field.scrollIntoView({behavior:'smooth', block:'center'});
      setTimeout(() => field.focus({preventScroll:true}), 180);
    }, 40);
  }
}

document.addEventListener('keydown', function(e) {
  const dialog = document.getElementById('validation-dialog');
  if (!dialog || !dialog.classList.contains('open')) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    closeValidationDialog();
  } else if (e.key === 'Escape') {
    // Mandatory validation must be acknowledged with OK.
    e.preventDefault();
  }
});


// RFQ keyboard shortcut: Ctrl/Cmd + S saves the open RFQ form.
document.addEventListener('keydown', function(e) {
  const modal=document.getElementById('rfq-modal');
  if(!modal || !modal.classList.contains('open')) return;
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s') {
    e.preventDefault();
    confirmSaveRFQEntry();
  }
});

let toastTimer;
function hideToast(){
  clearTimeout(toastTimer);
  const t=document.getElementById('toast');
  if(t) t.classList.remove('show');
}
/* ── Busy overlay ──
   Covers a modal/panel with a spinner + message while a save is in
   flight, and — critically — blocks all clicks underneath it (Cancel,
   Close, other buttons) so a slow save can never look "frozen" or be
   interrupted mid-save. Always paired with try/finally at the call
   site so it's removed even if the save throws. */
function showBusyOverlay(containerId, message='Saving') {
  const container = document.getElementById(containerId);
  if (!container) return;
  hideBusyOverlay(containerId);
  if (getComputedStyle(container).position === 'static') {
    container.dataset._busyPrevStatic = '1';
    container.style.position = 'relative';
  }
  const overlay = document.createElement('div');
  overlay.className = 'busy-overlay';
  overlay.id = containerId + '-busy-overlay';
  const cleanMessage = String(message).replace(/[.…\s]+$/, ''); // animated dots supply the trailing "..."
  overlay.innerHTML = `<div class="busy-overlay-ring-wrap"><div class="busy-overlay-ring"></div><div class="busy-overlay-bars"><div class="busy-overlay-bar b1"></div><div class="busy-overlay-bar o"></div><div class="busy-overlay-bar b2"></div></div></div><div class="busy-overlay-text">${esc(cleanMessage)}</div>`;
  container.appendChild(overlay);
}
function hideBusyOverlay(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const overlay = document.getElementById(containerId + '-busy-overlay');
  if (overlay) overlay.remove();
  if (container.dataset._busyPrevStatic) { container.style.position = ''; delete container.dataset._busyPrevStatic; }
}

function showToast(msg,type='',title='') {
  const t=document.getElementById('toast'); if(!t) return;
  clearTimeout(toastTimer);
  const kind=['success','error','warning','info'].includes(type) ? type : 'info';
  const defaults={success:'Saved successfully',error:'Action required',warning:'Warning',info:'Information'};
  const icons={success:'ti-circle-check',error:'ti-alert-circle',warning:'ti-alert-triangle',info:'ti-info-circle'};
  const durations={success:3200,info:4500,warning:6500,error:0};
  const duration=durations[kind];
  const safeTitle=esc(String(title||defaults[kind]||'Information'));
  const safeMsg=esc(String(msg??''));
  t.className='toast '+kind;
  t.style.setProperty('--toast-duration',duration+'ms');
  t.innerHTML=`<button class="toast-close" type="button" aria-label="Close notification" onclick="hideToast()">×</button><div class="toast-inner"><span class="toast-icon" aria-hidden="true"><i class="ti ${icons[kind]}\"></i></span><div class="toast-content"><div class="toast-title">${safeTitle}</div>${safeMsg?`<div class="toast-message">${safeMsg}</div>`:''}</div></div>${duration?'<div class="toast-progress" aria-hidden="true"></div>':''}`;
  // Reflow ensures the progress animation restarts even when notifications arrive back-to-back.
  void t.offsetWidth;
  requestAnimationFrame(()=>t.classList.add('show'));
  if(duration) toastTimer=setTimeout(()=>t.classList.remove('show'),duration);
}

async function resetAndReload() {
  if (!confirm('This will clear all stored data and reload the built-in records. Any quotations or customers you added manually will be lost. Continue?')) return;
  try { localStorage.removeItem('dtq_theme'); localStorage.removeItem('dtq_fontidx'); } catch(e) {}
  try { localStorage.removeItem('dtq_quotations'); } catch(e){}
  try { localStorage.removeItem('dtq_products'); } catch(e){}
  try { localStorage.removeItem('dtq_delivery_terms'); } catch(e){}
  try { localStorage.removeItem('dtq_payment_terms'); } catch(e){}
  try { localStorage.removeItem('dtq_customers'); } catch(e){}
  try { localStorage.removeItem('dtq_settings'); } catch(e){}
  try { await window.storage.delete('quotations'); } catch(e){}
  try { await window.storage.delete('customers_v2'); } catch(e){}
  try { await window.storage.delete('settings_v2'); } catch(e){}
  quotations = []; customers = []; settings = {};
  showToast('Data cleared — reloading…');
  setTimeout(() => location.reload(), 800);
}


/* ══════════════════════════════════════════════════
   EXPORT / IMPORT — full data backup & restore
══════════════════════════════════════════════════ */
function exportAllData() {
  const now = new Date();
  const stamp = now.getFullYear() + '-'
    + String(now.getMonth()+1).padStart(2,'0') + '-'
    + String(now.getDate()).padStart(2,'0') + '_'
    + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0');

  const backup = {
    _app:        'BizCore — Downtown Trading Est.',
    _version:    '1.0',
    _exportedAt: now.toISOString(),
    quotations,
    customers,
    suppliers,
    products,
    rfqs,
    settings,
    deliveryTerms,
    paymentTerms,
    salesOrders,
    appUsers,
    appRoles,
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], {type: 'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'BizCore_Backup_' + stamp + '.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  showToast('Backup exported successfully ✓', 'success');
}

function importAllData(event) {
  const file = event.target.files[0];
  if (!file) return;
  // Reset the file input so the same file can be re-selected if needed
  event.target.value = '';

  const reader = new FileReader();
  reader.onload = async function(e) {
    let data;
    try {
      data = JSON.parse(e.target.result);
    } catch {
      showToast('Invalid file — please select a valid BizCore backup (.json)', 'error');
      return;
    }

    // Basic validation — accepts both legacy QuoteFlow backups and new BizCore backups
    if (!data._app || !(data._app.includes('BizCore') || data._app.includes('QuoteFlow'))) {
      showToast('This file does not appear to be a BizCore backup', 'error');
      return;
    }

    // Summary counts for confirm dialog
    const qCount   = (data.quotations   || []).length;
    const cCount   = (data.customers    || []).length;
    const sCount   = (data.suppliers    || []).length;
    const pCount   = (data.products     || []).length;
    const rfqCount = (data.rfqs         || []).length;
    const exportedAt = data._exportedAt
      ? new Date(data._exportedAt).toLocaleString()
      : 'Unknown';

    const confirmed = await new Promise(resolve => {
      showConfirm({
        icon: '📂',
        title: 'Restore from backup?',
        message: 'This will REPLACE all current data with the backup contents. This cannot be undone.',
        details: {
          'Backup date':   exportedAt,
          'Quotations':    qCount,
          'RFQs':          rfqCount,
          'Customers':     cCount,
          'Suppliers':     sCount,
          'Products':      pCount,
        },
        confirmText: '✓ Yes, restore this backup',
        cancelText:  '← Cancel',
        confirmClass: 'btn-primary',
        onConfirm: () => resolve(true),
        onCancel:  () => resolve(false),
      });
    });

    if (!confirmed) return;

    // Restore data into memory
    quotations    = data.quotations    || [];
    customers     = data.customers     || [];
    suppliers     = data.suppliers     || [];
    products      = data.products      || [];
    rfqs          = data.rfqs          || [];
    settings      = data.settings      || {};
    deliveryTerms = data.deliveryTerms || [];
    paymentTerms  = data.paymentTerms  || [];
    salesOrders   = data.salesOrders   || [];
    appUsers      = data.appUsers      || appUsers;
    appRoles      = data.appRoles      || appRoles;
    saveAccessSetup();

    // Persist everything to localStorage AND Firebase
    try { localStorage.setItem('dtq_quotations',     JSON.stringify(quotations));    } catch(e) {}
    try { localStorage.setItem('dtq_customers',      JSON.stringify(customers));     } catch(e) {}
    try { localStorage.setItem('dtq_suppliers',      JSON.stringify(suppliers));     } catch(e) {}
    try { localStorage.setItem('dtq_products',       JSON.stringify(products));      } catch(e) {}
    try { localStorage.setItem('dtq_rfqs',           JSON.stringify(rfqs));          } catch(e) {}
    try { localStorage.setItem('dtq_settings',       JSON.stringify(settings));      } catch(e) {}
    try { localStorage.setItem('dtq_delivery_terms', JSON.stringify(deliveryTerms)); } catch(e) {}
    try { localStorage.setItem('dtq_payment_terms',  JSON.stringify(paymentTerms));  } catch(e) {}
    try { localStorage.setItem('dtq_salesorders',    JSON.stringify(salesOrders));   } catch(e) {}

    // Sync restored data to Firebase so all devices see it
    if (window.FB) {
      showToast('Syncing to cloud...', 'success');
      try {
        await Promise.all([
          window.FB.fbSave('quotations',    quotations),
          window.FB.fbSave('customers',     customers),
          window.FB.fbSave('suppliers',     suppliers),
          window.FB.fbSave('products',      products),
          window.FB.fbSave('rfqs',          rfqs),
          window.FB.fbSave('salesOrders',   salesOrders),
          window.FB.fbSave('deliveryTerms', deliveryTerms),
          window.FB.fbSave('paymentTerms',  paymentTerms),
          window.FB.fbSaveSettings(settings),
        ]);
        showToast('Backup restored and synced to cloud ✓ — all devices will now see this data', 'success');
      } catch(fbErr) {
        showToast('Restored locally — cloud sync failed. Check internet and try again.', 'error');
      }
    }

    applySettings();
    renderAll();
    if (!window.FB) {
      showToast('Backup restored successfully ✓ — ' + qCount + ' quotations, ' + rfqCount + ' RFQs', 'success');
    }
  };
  reader.readAsText(file);
}


/* ══════════════════════════════════════════════════════════════
   SALES ORDER MODULE
══════════════════════════════════════════════════════════════ */

let soFilter = 'all';
let soKpiFilter = 'none';
let soDateFilter = { mode: 'all', from: null, to: null };

/* ── Numbering ── */
function nextSONo() {
  const t = new Date();
  const prefix = 'SO-' + String(t.getFullYear()).slice(2) + String(t.getMonth()+1).padStart(2,'0') + '-';
  const nums = salesOrders.filter(s=>s.soNo.startsWith(prefix)).map(s=>parseInt(s.soNo.split('-').pop())||0);
  return prefix + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3,'0');
}
function nextDNNo(so) {
  const n = (so.deliveries||[]).length + 1;
  return so.soNo.replace('SO-','DN-') + '-' + String(n).padStart(2,'0');
}
function nextInvNo() {
  const t = new Date();
  const prefix = 'INV-' + String(t.getFullYear()).slice(2) + String(t.getMonth()+1).padStart(2,'0') + '-';
  const all = salesOrders.flatMap(s=>(s.invoices||[]).map(i=>i.invNo||''));
  const nums = all.filter(n=>n.startsWith(prefix)).map(n=>parseInt(n.split('-').pop())||0);
  return prefix + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3,'0');
}

/* ── SO Status helper ── */
function getSOStatus(so) {
  if (!so) return 'Confirmed';
  const totalPaid = (so.payments||[]).reduce((s,p)=>s+(parseFloat(p.amount)||0),0);
  const hasInvoice = (so.invoices||[]).length > 0;
  const deliveries = so.deliveries||[];
  const hasAnyDelivery = deliveries.length > 0;

  // Calculate confirmed-delivered qty per item
  const confirmedQty = {};
  deliveries.filter(d=>d.customerConfirmed).forEach(d => {
    (d.items||[]).forEach(it => {
      const idx = it.origIdx !== undefined ? it.origIdx : it.soIdx;
      confirmedQty[idx] = (confirmedQty[idx]||0) + deliveryAcceptedQty(d,it);
    });
  });
  const totalOrdered   = (so.items||[]).reduce((s,it,i)=>s+(parseFloat(it.qty)||0),0);
  const totalConfirmed = Object.values(confirmedQty).reduce((s,v)=>s+v,0);
  const allDelivered   = totalConfirmed >= totalOrdered - 0.001 && totalOrdered > 0;
  const partDelivered  = totalConfirmed > 0 && !allDelivered;

  const anyDispatched  = hasAnyDelivery && deliveries.some(d=>!d.customerConfirmed);

  if (totalPaid >= so.total && so.total > 0) return 'Paid';
  if (totalPaid > 0 && totalPaid < so.total) return 'Partially Paid';
  if (hasInvoice) return 'Invoiced';
  if (allDelivered && !anyDispatched) return 'Delivered';
  if (partDelivered && anyDispatched) return 'Out for Delivery'; // some confirmed, some still in transit
  if (partDelivered) return 'Partially Delivered';              // some confirmed, nothing in transit
  if (anyDispatched) return 'Out for Delivery';                 // nothing confirmed yet
  return 'Confirmed';
}
function getSOBadgeClass(status) {
  return {
    'Confirmed':          'badge-so-confirmed',
    'Out for Delivery':   'badge-so-ofd',
    'Partially Delivered':'badge-so-partdel',
    'Delivered':          'badge-so-delivered',
    'Invoiced':           'badge-so-invoiced',
    'Paid':               'badge-so-paid',
    'Partially Paid':     'badge-so-partial',
  }[status]||'badge-so-confirmed';
}

/* ── Render SO page ── */
function filterSO(status, btn) {
  soFilter = status;
  soKpiFilter = 'none';
  soPage = 1;
  document.querySelectorAll('.so-kpi').forEach(card=>{ card.classList.remove('active'); card.setAttribute('aria-pressed','false'); });
  document.querySelectorAll('.so-filter-btn').forEach(b=>{ if(!b.id.startsWith('so-d-')) b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  renderSOPage();
}

function handleSOKPIKey(event, filter, card) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    filterSOKPI(filter, card);
  }
}

function filterSOKPI(filter, card) {
  soKpiFilter = filter==='all' ? 'none' : filter;
  soFilter = 'all';
  soPage = 1;
  document.querySelectorAll('#page-salesorders .so-kpi').forEach(el=>{
    const key=el.dataset.kpiFilter||'';
    const active=(soKpiFilter==='none'&&key==='all') || key===soKpiFilter;
    el.classList.toggle('active',active);
    el.setAttribute('aria-pressed',active?'true':'false');
  });
  renderSOPage();
  updateSOOverviewTint();
}

function clearSOKPIFilter() {
  soKpiFilter = 'none';
  soPage = 1;
  document.querySelectorAll('.so-kpi').forEach(card=>{ card.classList.remove('active'); card.setAttribute('aria-pressed','false'); });
  renderSOPage();
  updateSOOverviewTint();
}

/* ── Date filter for Sales Orders ── */
function pad2(n){return String(n).padStart(2,'0');}
function dToStr(d){return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());}

function filterSODate(mode, btn) {
  const today = new Date();
  let from = null, to = null;

  if (mode === 'all') {
    from = null; to = null;
  } else if (mode === 'today') {
    from = to = dToStr(today);
  } else if (mode === 'week') {
    const day = today.getDay(); // 0=Sun
    const start = new Date(today); start.setDate(today.getDate() - day);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    from = dToStr(start); to = dToStr(end);
  } else if (mode === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth()+1, 0);
    from = dToStr(start); to = dToStr(end);
  } else if (mode === 'lastmonth') {
    const start = new Date(today.getFullYear(), today.getMonth()-1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    from = dToStr(start); to = dToStr(end);
  } else if (mode === '30days') {
    const start = new Date(today); start.setDate(today.getDate()-29);
    from = dToStr(start); to = dToStr(today);
  } else if (mode === 'last3months') {
    const start = new Date(today.getFullYear(), today.getMonth()-3, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    from = dToStr(start); to = dToStr(end);
  } else if (mode === 'year') {
    from = today.getFullYear()+'-01-01';
    to   = today.getFullYear()+'-12-31';
  } else if (mode === 'custom') {
    from = document.getElementById('so-d-from').value || null;
    to   = document.getElementById('so-d-to').value || null;
  }

  soDateFilter = { mode, from, to };
  soPage = 1;

  // Update active button styling (quick buttons only; custom inputs handled separately)
  if (btn) {
    document.querySelectorAll('[id^="so-d-"]').forEach(b=>{ if(b.tagName==='BUTTON') b.classList.remove('active'); });
    btn.classList.add('active');
  } else if (mode === 'custom') {
    document.querySelectorAll('[id^="so-d-"]').forEach(b=>{ if(b.tagName==='BUTTON') b.classList.remove('active'); });
  }

  const preset=document.getElementById('so-date-preset');
  if(preset && preset.value!==mode) preset.value=mode;
  renderSOPage();
}

function clearSODateFilter() {
  soPage = 1;
  document.getElementById('so-d-from').value = '';
  document.getElementById('so-d-to').value = '';
  soDateFilter = { mode:'all', from:null, to:null };
  document.querySelectorAll('[id^="so-d-"]').forEach(b=>{ if(b.tagName==='BUTTON') b.classList.remove('active'); });
  document.getElementById('so-d-all').classList.add('active');
  renderSOPage();
}

function clearAllSOFilters() {
  soFilter='all';
  soKpiFilter='none';
  soPage=1;
  soDateFilter={mode:'all',from:null,to:null};
  const search=document.getElementById('so-search');if(search)search.value='';
  const customer=document.getElementById('so-customer-filter');if(customer)customer.value='';
  const sort=document.getElementById('so-sort');if(sort)sort.value='date-desc';
  const preset=document.getElementById('so-date-preset');if(preset)preset.value='all';
  const from=document.getElementById('so-d-from');if(from)from.value='';
  const to=document.getElementById('so-d-to');if(to)to.value='';
  document.querySelectorAll('#page-salesorders .so-kpi').forEach(card=>{card.classList.remove('active');card.setAttribute('aria-pressed','false');});
  document.querySelector('#page-salesorders .so-overview-total')?.classList.add('active');
  renderSOPage();
}

function renderSOPage() {
  const search=(document.getElementById('so-search')?.value||'').trim().toLowerCase();
  const customerFilter=document.getElementById('so-customer-filter')?.value||'';
  const sortValue=document.getElementById('so-sort')?.value||'date-desc';

  let all=salesOrders.map(so=>({...so,_status:getSOStatus(so)}));

  // Customer filter options, preserving current selection.
  const customerSelect=document.getElementById('so-customer-filter');
  if(customerSelect){
    const selected=customerSelect.value;
    const names=[...new Set(all.map(s=>s.customer).filter(Boolean))].sort();
    customerSelect.innerHTML='<option value="">All customers</option>'+names.map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
    customerSelect.value=names.includes(selected)?selected:'';
  }

  // Overview scope reacts to Customer + Date + Search, but not status/KPI selection.
  let scope=all.filter(s=>{
    if(customerFilter && s.customer!==customerFilter) return false;
    if(soDateFilter.from && (s.date||'')<soDateFilter.from) return false;
    if(soDateFilter.to && (s.date||'')>soDateFilter.to) return false;
    if(search){
      const hay=`${s.soNo||''} ${s.customer||''} ${s.poNo||''}`.toLowerCase();
      if(!hay.includes(search)) return false;
    }
    return true;
  });

  const statusCounts={};
  scope.forEach(s=>statusCounts[s._status]=(statusCounts[s._status]||0)+1);
  const open=scope.filter(s=>['Confirmed','Out for Delivery','Partially Delivered'].includes(s._status));
  const ready=scope.filter(s=>s._status==='Confirmed');
  const partial=scope.filter(s=>s._status==='Partially Delivered');
  const pendingInvoice=scope.filter(s=>(s.deliveries||[]).some(d=>d.customerConfirmed)&&!(s.invoices||[]).length);
  const totalOrderValue=scope.reduce((sum,s)=>sum+(parseFloat(s.total)||0),0);
  const outstandingReceivables=scope.reduce((sum,s)=>{
    if(!(s.invoices||[]).length)return sum;
    const paid=(s.payments||[]).reduce((p,x)=>p+(parseFloat(x.amount)||0),0);
    return sum+Math.max((parseFloat(s.total)||0)-paid,0);
  },0);

  const setText=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val};
  setText('so-k-total',scope.length);
  setText('so-k-confirmed',statusCounts['Confirmed']||0);
  setText('so-k-ofd',statusCounts['Out for Delivery']||0);
  setText('so-k-partial-delivery',statusCounts['Partially Delivered']||0);
  setText('so-k-delivered',statusCounts['Delivered']||0);
  setText('so-k-invoiced',statusCounts['Invoiced']||0);
  setText('so-k-partpaid',statusCounts['Partially Paid']||0);
  setText('so-k-paid',statusCounts['Paid']||0);
  setText('so-k-open',open.length);
  setText('so-k-invoice',pendingInvoice.length);
  setText('so-k-value',formatNumber(totalOrderValue,2));
  setText('so-k-receivables',formatNumber(outstandingReceivables,2));

  const badge=document.getElementById('so-badge');
  if(badge){
    badge.textContent=open.length;
    badge.style.display=open.length?'inline-flex':'none';
  }

  // Start the table from the current non-status scope.
  let list=[...scope];

  // Status / Overview drill-down.
  if(soFilter==='pending') list=list.filter(s=>s._status!=='Paid');
  else if(soFilter!=='all') list=list.filter(s=>s._status===soFilter);

  if(soKpiFilter==='status-confirmed') list=list.filter(s=>s._status==='Confirmed');
  else if(soKpiFilter==='status-ofd') list=list.filter(s=>s._status==='Out for Delivery');
  else if(soKpiFilter==='status-partdel') list=list.filter(s=>s._status==='Partially Delivered');
  else if(soKpiFilter==='status-delivered') list=list.filter(s=>s._status==='Delivered');
  else if(soKpiFilter==='status-invoiced') list=list.filter(s=>s._status==='Invoiced');
  else if(soKpiFilter==='status-partpaid') list=list.filter(s=>s._status==='Partially Paid');
  else if(soKpiFilter==='status-paid') list=list.filter(s=>s._status==='Paid');
  else if(soKpiFilter==='open') list=list.filter(s=>['Confirmed','Out for Delivery','Partially Delivered'].includes(s._status));
  else if(soKpiFilter==='pending-invoice') list=list.filter(s=>(s.deliveries||[]).some(d=>d.customerConfirmed)&&!(s.invoices||[]).length);
  else if(soKpiFilter==='receivables') list=list.filter(s=>{
    if(!(s.invoices||[]).length)return false;
    const paid=(s.payments||[]).reduce((p,x)=>p+(parseFloat(x.amount)||0),0);
    return Math.max((parseFloat(s.total)||0)-paid,0)>0;
  });

  if(sortValue==='date-asc') list.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  else if(sortValue==='amount-desc') list.sort((a,b)=>(parseFloat(b.total)||0)-(parseFloat(a.total)||0));
  else if(sortValue==='amount-asc') list.sort((a,b)=>(parseFloat(a.total)||0)-(parseFloat(b.total)||0));
  else list.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  list=sortRegisterRows(list,'so',{no:s=>s.soNo,date:s=>s.date,customer:s=>s.customer,po:s=>s.poNo,quotation:s=>quotations.find(q=>q.id===s.quotationId)?.qno||'',items:s=>(s.items||[]).length,amount:s=>parseFloat(s.total)||0,status:s=>s._status||getSOStatus(s)});

  const countEl=document.getElementById('so-register-count');
  if(countEl)countEl.textContent=`${list.length} order${list.length===1?'':'s'}`;

  // Active filter highlighting.
  document.querySelectorAll('#page-salesorders .so-kpi').forEach(el=>{
    const key=el.dataset.kpiFilter||'';
    const active=(soKpiFilter==='none'&&key==='all') || (soKpiFilter===key);
    el.classList.toggle('active',active);
    el.setAttribute('aria-pressed',active?'true':'false');
  });
  updateSOOverviewTint();
  const clearBtn=document.getElementById('so-clear-filters-btn');
  const hasFilters=!!(customerFilter||search||soDateFilter.mode!=='all'||sortValue!=='date-desc'||soKpiFilter!=='none'||soFilter!=='all');
  if(clearBtn){
    clearBtn.classList.toggle('active',hasFilters);
    clearBtn.disabled=!hasFilters;
  }

  const tbody=document.getElementById('so-register-tbody');
  const soPages=Math.ceil(list.length/SO_PER_PAGE)||1;
  if(soPage>soPages)soPage=1;
  const slice=list.slice((soPage-1)*SO_PER_PAGE,soPage*SO_PER_PAGE);

  if(tbody){
    tbody.innerHTML=slice.length?slice.map(so=>{
      const q=quotations.find(x=>x.id===so.quotationId);
      const status=getSOStatus(so);
      const rowStyle='font-size:14px!important;font-weight:400!important;color:#111827!important;line-height:1.35!important';
      return `<tr class="so-register-row" tabindex="0" role="button" onclick="viewSO('${so.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();viewSO('${so.id}')}">
        <td style="${rowStyle}">${escapeHtml(so.soNo||'—')}</td>
        <td style="${rowStyle}">${fmtDate(so.date)}</td>
        <td style="${rowStyle}">${escapeHtml(so.customer||'—')}</td>
        <td style="${rowStyle}"><span class="so-register-po">${escapeHtml(so.poNo||'—')}${so.poAttachment?.url?'<i class="ti ti-paperclip so-register-attachment" title="Customer PO attached" aria-label="Customer PO attached"></i>':''}</span></td>
        <td style="${rowStyle}">${q?escapeHtml(q.qno):'—'}</td>
        <td class="center" style="${rowStyle}">${(so.items||[]).length}</td>
        <td class="right" style="${rowStyle}">${formatNumber(parseFloat(so.total)||0,2)}</td>
        <td style="${rowStyle}"><span class="badge ${getSOBadgeClass(status)}">${status}</span></td>
      </tr>`;
    }).join(''):`<tr><td colspan="8"><div class="empty-state"><i class="ti ti-shopping-cart"></i><strong>No sales orders found</strong><p>Adjust the filters or create a Sales Order from an approved quotation.</p></div></td></tr>`;
  }

  document.querySelectorAll('.rows-per-page-select').forEach(el=>{if(el.value!==String(SO_PER_PAGE))el.value=String(SO_PER_PAGE)});
  const sop=document.getElementById('so-pagination');
  if(sop)sop.innerHTML=buildPaginationHTML(soPage,soPages,'goSOPage');
}
function goSOPage(p){soPage=p;renderSOPage();}

/* ── Open Create SO modal ── */
function getQuotationSOProgress(quotationId, excludeSOId='') {
  const q=quotations.find(x=>x.id===quotationId);
  if(!q) return {remaining:[],complete:true,linked:[]};
  const linked=salesOrders.filter(so=>so.quotationId===quotationId && so.id!==excludeSOId);
  const ordered={};
  linked.forEach(so=>(so.items||[]).forEach(it=>{ const idx=Number(it.origIdx); ordered[idx]=roundQtyForUom((ordered[idx]||0)+(parseFloat(it.qty)||0),it.uom); }));
  const remaining=(q.items||[]).map((it,i)=>{const quoted=parseFloat(it.qty)||0, prev=ordered[i]||0, rem=roundQtyForUom(Math.max(0,quoted-prev),it.uom);return {...it,origIdx:i,origQty:quoted,orderedQty:prev,remainingQty:rem};}).filter(it=>it.remainingQty>0);
  return {remaining,complete:remaining.length===0,linked};
}
function soFormatFileSize(bytes){if(!Number.isFinite(bytes)||bytes<=0)return '';if(bytes<1024)return bytes+' B';if(bytes<1024*1024)return (bytes/1024).toFixed(bytes<10240?1:0)+' KB';return (bytes/(1024*1024)).toFixed(1)+' MB';}
function soAttachmentMeta(att){if(!att)return '';const bits=[];if(att.type)bits.push(String(att.type).split('/').pop().toUpperCase());if(att.size)bits.push(soFormatFileSize(Number(att.size)));return bits.join(' · ')||'Customer PO attachment';}
function soViewPOAttachment(soId){const so=salesOrders.find(x=>x.id===soId),url=so?.poAttachment?.url;if(!url){showToast('No Customer PO attachment is available for this Sales Order.','info','No Attachment');return;}const win=window.open(url,'_blank','noopener,noreferrer');if(!win)showToast('Your browser blocked the attachment preview. Allow pop-ups or use Download.','warning','Preview Blocked');}
function soDownloadPOAttachment(soId){const so=salesOrders.find(x=>x.id===soId),att=so?.poAttachment;if(!att?.url){showToast('No Customer PO attachment is available for this Sales Order.','info','No Attachment');return;}const a=document.createElement('a');a.href=att.url;a.download=att.name||'Customer-PO';a.target='_blank';a.rel='noopener noreferrer';document.body.appendChild(a);a.click();a.remove();}
function soRenderPOAttachment(file=null,existing=null){
  const empty=document.getElementById('so-po-empty'),selected=document.getElementById('so-po-selected'),name=document.getElementById('so-po-file-name'),meta=document.getElementById('so-po-file-meta');
  const has=!!(file||existing);if(empty)empty.style.display=has?'none':'flex';if(selected)selected.style.display=has?'flex':'none';
  if(!has)return;if(name)name.textContent=file?.name||existing?.name||'Customer PO attachment';
  if(meta)meta.textContent=file?(soFormatFileSize(file.size)+(file.type?' · '+file.type.split('/').pop().toUpperCase():'')):(existing?.url?'Attached to this Sales Order':'Existing attachment');
}
function soPreparePOFilePicker(event){event?.stopPropagation();const input=document.getElementById('so-po-file');if(input)input.value='';}
function soBrowsePOFile(event){event?.preventDefault();event?.stopPropagation();const input=document.getElementById('so-po-file');if(!input)return;input.value='';input.click();}
function soAttachmentAreaClick(event){if(event?.target?.closest('label,button,a'))return;soBrowsePOFile(event);}
function soReplacePOFile(event){soBrowsePOFile(event);}
function soPOAttachmentKeydown(event){if(event.key==='Enter'||event.key===' '){event.preventDefault();soBrowsePOFile(event);}}
function soPOFileChanged(input){const f=input?.files?.[0]||null;const modal=document.getElementById('so-create-modal');if(modal)modal._poAttachmentRemoved=false;soRenderPOAttachment(f,modal?modal._poAttachment:null);}
function soRemovePOFile(event){event?.preventDefault();event?.stopPropagation();const fi=document.getElementById('so-po-file');if(fi)fi.value='';const modal=document.getElementById('so-create-modal');if(modal){modal._poAttachment=null;modal._poAttachmentRemoved=true;}soRenderPOAttachment();}
function renderSOCreateItems(items,currentByOrig={}){
  document.getElementById('so-items-list').innerHTML=items.map((it,i)=>{const current=currentByOrig[it.origIdx]||0;const checked=current>0||!Object.keys(currentByOrig).length;const qty=current>0?current:it.remainingQty;const after=Math.max(0,it.remainingQty-qty);return `
    <div class="so-item-row">
      <input type="checkbox" class="so-item-check" id="soc-chk-${i}" ${checked?'checked':''} onchange="soCalcSummary()">
      <div><div style="font-weight:600;color:#0f172a">${escapeHtml(it.desc||'—')}</div>${it.brand||it.model?`<div style="font-size:11px;color:var(--gray)">${escapeHtml([it.brand,it.model].filter(Boolean).join(' / '))}</div>`:''}</div>
      <div class="so-num">${formatQtyForUom(it.origQty,it.uom)}</div><div class="so-num so-muted">${formatQtyForUom(it.orderedQty||0,it.uom)}</div>
      <div><input type="number" class="so-qty-input" id="soc-qty-${i}" value="${qty}" min="${qtyMin(it.uom)}" max="${it.remainingQty}" step="${qtyStep(it.uom)}" oninput="soCalcSummary()"></div>
      <div class="so-num so-remain" id="soc-rem-${i}">${formatQtyForUom(after,it.uom)}</div><div>${escapeHtml(it.uom||'—')}</div>
      <div class="so-num">${documentMoney('salesOrder','unitPrice',parseFloat(it.up)||0)}</div><div class="so-num" style="font-weight:600;color:var(--blue)" id="soc-tot-${i}">—</div>
    </div>`}).join('');
}
function openCreateSO(quotationId) {
  const q=quotations.find(x=>x.id===quotationId); if(!q)return;
  const progress=getQuotationSOProgress(quotationId);
  if(progress.complete){showToast('All quoted quantities have already been ordered.','info','Quotation Fully Ordered');return;}
  const modal=document.getElementById('so-create-modal');
  modal._editingSOId=null;modal._quotationId=quotationId;modal._remainingItems=progress.remaining;modal._vatRate=vatRate(q);modal._poAttachment=null;modal._saveOperationId=(globalThis.crypto?.randomUUID?.()||('so-'+Date.now()+'-'+Math.random().toString(36).slice(2)));
  document.getElementById('so-create-title').textContent='Create Sales Order';
  document.getElementById('so-create-subtitle').textContent=`Create from ${q.qno} · ${progress.linked.length?progress.linked.length+' previous order'+(progress.linked.length===1?'':'s'):'first order'}`;
  document.getElementById('so-save-btn-text').textContent='Save Sales Order';document.getElementById('so-no').value='Auto on Save';document.getElementById('so-date').value=new Date().toISOString().split('T')[0];
  ['so-po-no','so-po-date','so-project','so-contact','so-expected-delivery','so-notes','so-internal-note'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  document.getElementById('so-customer').value=q.company||'';document.getElementById('so-quote-ref').value=q.qno+' — '+fmtDate(q.date);document.getElementById('so-payment').value=q.payment||settings.payment||'';document.getElementById('so-delivery').value=q.delivery||settings.delivery||'';
  const fi=document.getElementById('so-po-file');if(fi)fi.value='';modal._poAttachment=null;modal._poAttachmentRemoved=false;soRenderPOAttachment();clearFieldValidation(document.getElementById('so-po-no'));
  renderSOCreateItems(progress.remaining);soCalcSummary();openModalWithSize('so-create-modal');
}
function soSelectAll(check) {
  const modal = document.getElementById('so-create-modal');
  const items = modal._remainingItems||[];
  items.forEach((_,i) => { const cb=document.getElementById('soc-chk-'+i); if(cb) cb.checked=check; });
  soCalcSummary();
}

function soCalcSummary() {
  const modal=document.getElementById('so-create-modal'),items=modal._remainingItems||[],vr=modal._vatRate||0.15;
  let sub=0,partial=false;
  items.forEach((it,i)=>{const chk=document.getElementById('soc-chk-'+i);let qty=roundQtyForUom(document.getElementById('soc-qty-'+i)?.value,it.uom);if(qty>it.remainingQty)qty=it.remainingQty;if(qty<0)qty=0;const selected=!!chk?.checked;const tot=selected?qty*(parseFloat(it.up)||0):0;sub+=tot;const after=selected?Math.max(0,it.remainingQty-qty):it.remainingQty;if(after>0)partial=true;const t=document.getElementById('soc-tot-'+i);if(t)t.textContent=selected?documentMoney('salesOrder','lineAmount',tot):'—';const r=document.getElementById('soc-rem-'+i);if(r)r.textContent=formatQtyForUom(after,it.uom);});
  const vat=Math.round(sub*vr*100)/100,total=sub+vat,q=quotations.find(x=>x.id===modal._quotationId),quoteValue=q?calcQuote(q).net:0;
  document.getElementById('so-sum-quote').textContent=documentMoney('salesOrder','summary',quoteValue);document.getElementById('so-sum-order').textContent=documentMoney('salesOrder','summary',total);document.getElementById('so-sum-sub').textContent=documentMoney('salesOrder','summary',sub);document.getElementById('so-sum-vat').textContent=documentMoney('salesOrder','summary',vat);document.getElementById('so-sum-vat-label').textContent='VAT ('+Math.round(vr*100)+'%)';document.getElementById('so-sum-total').textContent=documentMoney('salesOrder','grandTotal',total);
  const note=document.getElementById('so-remaining-note');if(note){note.style.display=partial?'block':'none';note.innerHTML=partial?'<strong>Partial order</strong> — quantities remaining after this PO can be converted to another Sales Order later.':'';}
}
async function _saveSalesOrderCore() {
  const modal = document.getElementById('so-create-modal');
  const poNo = document.getElementById('so-po-no').value.trim();
  if (!poNo) {
    showValidationDialog(
      'Validation Required',
      'Customer PO Number is mandatory.\n\nPlease enter the Customer PO Number before creating the Sales Order.',
      'so-po-no',
      'Customer PO Number is required'
    );
    return;
  }

  const items = modal._remainingItems||[];
  const vr = modal._vatRate||0.15;
  const selectedItems = [];
  let sub = 0;
  let invalidQty = false;

  items.forEach((it,i) => {
    const chk = document.getElementById('soc-chk-'+i);
    const qty = roundQtyForUom(document.getElementById('soc-qty-'+i)?.value, it.uom);
    if (chk?.checked && qty > it.remainingQty) { if(!invalidQty) showValidationDialog('Quantity Exceeds Available', `The ordered quantity for ${it.desc||'this item'} cannot exceed ${formatQtyForUom(it.remainingQty,it.uom)} ${it.uom||''}.`, 'soc-qty-'+i, 'Reduce the ordered quantity'); invalidQty=true; return; }
    if (chk?.checked && qty > 0) {
      selectedItems.push({...it, qty});
      sub += qty * (parseFloat(it.up)||0);
    }
  });

  if (invalidQty) return;
  if (!selectedItems.length) { showToast('Please select at least one item','error'); return; }

  const vat = Math.round(sub * vr * 100) / 100;
  const total = sub + vat;

  const editingId = modal._editingSOId;
  const existingSO = editingId ? salesOrders.find(x=>x.id===editingId) : null;
  const soNumber = existingSO?.soNo || await allocateDocumentNumber('salesOrder',new Date((document.getElementById('so-date').value||new Date().toISOString().slice(0,10))+'T00:00:00'));
  let poAttachment=modal._poAttachmentRemoved?null:(modal._poAttachment||existingSO?.poAttachment||null);
  const poFile=document.getElementById('so-po-file')?.files?.[0];
  if(poFile&&window.FB?.uploadFile){try{const url=await window.FB.uploadFile('sales-orders/'+soNumber+'/customer-po',poFile);if(url)poAttachment={name:poFile.name,url,size:poFile.size||0,type:poFile.type||''};}catch(e){showToast('Customer PO attachment could not be uploaded. Please try again.','error','Upload Failed');return;}}
  const so = {
    id:          existingSO?.id || ('SO-' + Date.now()),
    creationOperationId: existingSO?.creationOperationId || modal._saveOperationId || '',
    soNo:        soNumber,
    date:        document.getElementById('so-date').value,
    poNo,
    poDate:      document.getElementById('so-po-date')?.value||'',
    project:     document.getElementById('so-project')?.value.trim()||'',
    contact:     document.getElementById('so-contact')?.value.trim()||'',
    expectedDelivery: document.getElementById('so-expected-delivery')?.value||'',
    payment:     document.getElementById('so-payment')?.value||'',
    delivery:    document.getElementById('so-delivery')?.value||'',
    internalNote:document.getElementById('so-internal-note')?.value.trim()||'',
    poAttachment,
    customer:    document.getElementById('so-customer').value,
    custId:      (()=>{const q=quotations.find(x=>x.id===modal._quotationId);return q?.custId||findUniqueMasterByName(customers,document.getElementById('so-customer').value)?.id||'';})(),
    quotationId: modal._quotationId,
    notes:       document.getElementById('so-notes').value.trim(),
    items:       selectedItems,
    subtotal:    sub,
    vat,
    total,
    vatRate:     vr,
    deliveries:  [],
    invoices:    [],
    payments:    [],
    created:     new Date().toISOString(),
  };

  if (editingId) {
    const idx = salesOrders.findIndex(x=>x.id===editingId);
    if (idx<0) return;
    const existing=salesOrders[idx];
    so.id=existing.id;
    so.soNo=existing.soNo;
    so.created=existing.created;
    so.updated=new Date().toISOString();
    so.deliveries=existing.deliveries||[];
    so.invoices=existing.invoices||[];
    so.payments=existing.payments||[];
    salesOrders[idx]=so;
  } else {
    salesOrders.unshift(so);
  }
  const linkedQuote = quotations.find(q=>q.id===so.quotationId);
  let linkedRFQ = null;
  if (linkedQuote?.rfqId) {
    linkedRFQ = rfqs.find(r=>r.id===linkedQuote.rfqId);
    if (linkedRFQ) linkedRFQ.status='Sales Order';
  }
  await Promise.all([
    saveSalesOrders(),
    linkedRFQ ? saveRFQs() : Promise.resolve()
  ]);
  closeModal('so-create-modal');
  renderSOPage();
  showToast(editingId ? `Sales Order ${so.soNo} has been updated successfully.` : `Sales Order ${so.soNo} has been created successfully.`, 'success', editingId?'Sales Order Updated':'Sales Order Created');
  viewSO(so.id);
  return so;
}

/* ── v114: protected transactional document save ──
   Global standard for create/update actions that may wait on Firebase, uploads,
   numbering, or rendering. The first click owns the operation until it settles.
   Repeated clicks are ignored, and the blocking overlay is operation-driven. */
const _documentSaveLocks=new Set();
async function runProtectedDocumentSave({key,message,buttonId,buttonTextId,busyText='Saving…',action,ready}={}){
  if(!key||typeof action!=='function')return null;
  if(_documentSaveLocks.has(key))return null;
  _documentSaveLocks.add(key);
  const btn=buttonId?document.getElementById(buttonId):null;
  const text=buttonTextId?document.getElementById(buttonTextId):null;
  const originalText=text?.textContent||'';
  if(btn){btn.disabled=true;btn.setAttribute('aria-busy','true');}
  if(text)text.textContent=busyText;
  try{
    return await runScreenTransition({message:message||busyText,immediate:true,action,ready,endImmediate:true,errorMessage:'The save could not be completed. Please try again.'});
  }finally{
    _documentSaveLocks.delete(key);
    if(btn){btn.disabled=false;btn.removeAttribute('aria-busy');}
    if(text&&document.body.contains(text))text.textContent=originalText;
  }
}
window.BizCoreDocumentSave={run:runProtectedDocumentSave,isBusy:key=>_documentSaveLocks.has(key)};

async function saveSalesOrder(){
  const modal=document.getElementById('so-create-modal');
  if(!modal)return;
  const editingId=modal._editingSOId||'';
  const operationId=editingId?('edit:'+editingId):(modal._saveOperationId||('create:'+modal._quotationId));
  // Idempotency safety: if this exact creation operation already completed,
  // never create a second SO. Re-open the document that was already created.
  if(!editingId&&modal._saveOperationId){
    const already=salesOrders.find(x=>x.creationOperationId===modal._saveOperationId);
    if(already){closeModal('so-create-modal');viewSO(already.id);showToast(`Sales Order ${already.soNo} was already created.`,'info','Already Saved');return already;}
  }
  return runProtectedDocumentSave({
    key:'salesOrder:'+operationId,
    message:editingId?'Saving Sales Order changes…':'Saving Sales Order…',
    buttonId:'so-save-btn',buttonTextId:'so-save-btn-text',busyText:editingId?'Saving Changes…':'Saving Sales Order…',
    action:()=>_saveSalesOrderCore(),
    ready:(so)=>!so||isModalOpen('so-view-modal')
  });
}

/* ── Edit / delete Sales Order ── */
function soHasDownstreamActivity(so){
  return !!((so.deliveries||[]).length || (so.invoices||[]).length || (so.payments||[]).length);
}
function openEditSO(soId){
  const so=salesOrders.find(x=>x.id===soId);if(!so)return;if(soHasDownstreamActivity(so)){showValidationDialog('Editing Restricted','This Sales Order already has delivery, invoice, or payment activity. To protect document history, it cannot be edited.','','');return;}
  const q=quotations.find(x=>x.id===so.quotationId);if(!q){showToast('The linked quotation could not be found.','error');return;}
  const currentByOrig={};(so.items||[]).forEach(it=>currentByOrig[it.origIdx]=(currentByOrig[it.origIdx]||0)+(parseFloat(it.qty)||0));
  const progress=getQuotationSOProgress(so.quotationId,so.id),available=progress.remaining;
  const modal=document.getElementById('so-create-modal');modal._editingSOId=so.id;modal._saveOperationId=so.creationOperationId||'';modal._quotationId=so.quotationId;modal._remainingItems=available;modal._vatRate=so.vatRate||vatRate(q);
  document.getElementById('so-create-title').textContent='Edit Sales Order';document.getElementById('so-create-subtitle').textContent=so.soNo+' · linked to '+q.qno;document.getElementById('so-save-btn-text').textContent='Save Changes';
  const vals={'so-no':so.soNo,'so-date':so.date,'so-po-no':so.poNo||'','so-po-date':so.poDate||'','so-project':so.project||'','so-contact':so.contact||'','so-customer':so.customer,'so-quote-ref':q.qno+' — '+fmtDate(q.date),'so-payment':so.payment||q.payment||'','so-delivery':so.delivery||q.delivery||'','so-expected-delivery':so.expectedDelivery||'','so-notes':so.notes||'','so-internal-note':so.internalNote||''};Object.entries(vals).forEach(([id,v])=>{const e=document.getElementById(id);if(e)e.value=v;});
  const fi=document.getElementById('so-po-file');if(fi)fi.value='';modal._poAttachment=so.poAttachment||null;modal._poAttachmentRemoved=false;soRenderPOAttachment(null,modal._poAttachment);clearFieldValidation(document.getElementById('so-po-no'));renderSOCreateItems(available,currentByOrig);closeModal('so-view-modal');soCalcSummary();openModalWithSize('so-create-modal');
}
function deleteSalesOrder(soId){
  const so=salesOrders.find(x=>x.id===soId); if(!so) return;
  if(soHasDownstreamActivity(so)){
    showValidationDialog('Deletion Restricted','This Sales Order has related delivery, invoice, or payment records and cannot be deleted. This protects the audit trail.','','');
    return;
  }
  showConfirm({icon:'🗑️',title:'Delete Sales Order?',message:`Delete ${so.soNo} for ${so.customer}? This action cannot be undone.`,confirmText:'Delete Order',confirmClass:'btn-danger',onConfirm:async()=>{
    salesOrders=salesOrders.filter(x=>x.id!==soId);
    await saveSalesOrders();
    closeModal('so-view-modal'); renderSOPage();
    showToast(`Sales Order ${so.soNo} has been deleted.`, 'success','Sales Order Deleted');
  }});
}

/* ── View Sales Order ── */
function viewSO(soId) {
  const so = salesOrders.find(x=>x.id===soId); if (!so) return;
  currentSOId = soId;
  const status = getSOStatus(so);
  const q = quotations.find(x=>x.id===so.quotationId);
  const badgeCls = getSOBadgeClass(status);

  // Pipeline bar
  const steps = [
    {s:'Confirmed',          icon:'ti-shopping-cart', label:'Order Confirmed'},
    {s:'Out for Delivery',   icon:'ti-truck',          label:'Out for Delivery'},
    {s:'Partially Delivered',icon:'ti-package',        label:'Partially Delivered'},
    {s:'Delivered',          icon:'ti-circle-check',   label:'Delivered'},
    {s:'Invoiced',           icon:'ti-file-invoice',   label:'Invoiced'},
    {s:'Paid',               icon:'ti-cash',            label:'Payment Received'},
  ];
  const stOrder2 = ['Confirmed','Out for Delivery','Partially Delivered','Delivered','Invoiced','Partially Paid','Paid'];
  const resolvedIdx = status==='Partially Paid' ? 4 : stOrder2.indexOf(status);
  const pipeline = `<div class="pipeline-track" style="margin:0">${steps.map((st,i)=>{
    const done = i < resolvedIdx || (st.s==='Paid'&&status==='Paid');
    const active = i===resolvedIdx && status!=='Paid';
    const partial = st.s==='Paid'&&status==='Partially Paid';
    const dotCls = done?'done':partial?'active':active?'active':'pending';
    const lCls = done?'done':active||partial?'active':'';
    return `<div class="pt-step"><div class="pt-dot ${dotCls}"><i class="ti ${st.icon}"></i></div><div class="pt-label ${lCls}">${st.label}</div></div>`;
  }).join('')}</div>`;
  document.getElementById('so-pipeline-bar').innerHTML =
    `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
       <span style="font-size:11px;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:.05em">Order Status</span>
       <span class="badge ${badgeCls}" style="font-size:13px;padding:5px 14px;font-weight:600">${status}</span>
     </div>${pipeline}`;

  // Body
  const totalPaid = (so.payments||[]).reduce((s,p)=>s+(parseFloat(p.amount)||0),0);
  const outstanding = so.total - totalPaid;

  // Integrated order-item + delivery progress data
  const confirmedQtyMap = {};
  const transitQtyMap = {};
  (so.deliveries||[]).forEach(d => {
    (d.items||[]).forEach(it => {
      const idx = it.origIdx !== undefined ? it.origIdx : it.soIdx;
      if (d.customerConfirmed) confirmedQtyMap[idx] = roundQty((confirmedQtyMap[idx]||0) + deliveryAcceptedQty(d,it));
      else transitQtyMap[idx] = roundQty((transitQtyMap[idx]||0) + (parseFloat(it.qty)||0));
    });
  });

  // Compact overall delivery summary. Progress is the average fulfilment % across
  // order lines so mixed UOMs (PCS / MTR / BOX etc.) are never added together.
  const soItemProgress = (so.items||[]).map((it,i)=>{
    const ordered = parseFloat(it.qty)||0;
    const confirmed = confirmedQtyMap[i]||0;
    const transit = transitQtyMap[i]||0;
    const fulfilled = Math.min(ordered, confirmed + transit);
    const remaining = roundQty(Math.max(0, ordered - fulfilled));
    const pct = ordered > 0 ? Math.min(100, (fulfilled / ordered) * 100) : 100;
    return {ordered, confirmed, transit, remaining, pct};
  });
  const totalSOItems = soItemProgress.length;
  const fullyDeliveredItems = soItemProgress.filter(x=>x.remaining<=0.001 && x.transit<=0.001).length;
  const remainingItemCount = soItemProgress.filter(x=>x.remaining>0.001 || x.transit>0.001).length;
  const deliveryProgressPct = totalSOItems
    ? Math.round(soItemProgress.reduce((sum,x)=>sum+x.pct,0)/totalSOItems)
    : 0;
  const deliveryProgressSummary = totalSOItems ? `
    <div class="so-delivery-summary">
      <span>Delivery Progress: <strong>${deliveryProgressPct}%</strong></span>
      <span class="so-delivery-summary-sep">·</span>
      <span>${fullyDeliveredItems} of ${totalSOItems} items fully delivered</span>
      <span class="so-delivery-summary-sep">·</span>
      ${remainingItemCount > 0
        ? `<span class="so-delivery-remaining-alert">${remainingItemCount} ${remainingItemCount===1?'item':'items'} remaining</span>`
        : '<span class="so-delivery-complete-text"><i class="ti ti-circle-check"></i> Fully Delivered</span>'}
    </div>` : '';

  const itemsHtml = (so.items||[]).map((it,i)=>{
    const ordered = parseFloat(it.qty)||0;
    const confirmed = confirmedQtyMap[i]||0;
    const transit = transitQtyMap[i]||0;
    const remaining = roundQty(Math.max(0, ordered - confirmed - transit));
    const deliveryState = remaining<=0.001 && transit<=0.001
      ? '<span class="so-delivery-state complete"><i class="ti ti-circle-check"></i>Delivered</span>'
      : (confirmed>0 || transit>0)
        ? '<span class="so-delivery-state partial"><i class="ti ti-package"></i>Partial</span>'
        : '<span class="so-delivery-state pending"><i class="ti ti-clock"></i>Pending</span>';
    return `
    <tr style="background:${i%2===0?'#F8FAFC':'#fff'}">
      <td style="padding:7px 10px">${String(i+1).padStart(2,'0')}</td>
      <td style="padding:7px 10px"><div style="font-weight:500">${it.desc||'—'}</div>${it.brand||it.model?`<div style="font-size:11px;color:var(--gray)">${[it.brand,it.model].filter(Boolean).join(' / ')}</div>`:''}</td>
      <td style="padding:7px 10px;text-align:center">${ordered}</td>
      <td style="padding:7px 10px;text-align:center">${confirmed}</td>
      <td style="padding:7px 10px;text-align:center">${transit||'—'}</td>
      <td class="${remaining>0.001?'so-remaining-qty':''}" style="padding:7px 10px;text-align:center;font-weight:600">${remaining}</td>
      <td style="padding:7px 10px;text-align:center">${it.uom||'—'}</td>
      <td style="padding:7px 10px;text-align:center">${deliveryState}</td>
      <td style="padding:7px 10px;text-align:right">${fmt(parseFloat(it.up)||0)}</td>
      <td style="padding:7px 10px;text-align:right;font-weight:600">${fmt(ordered*(parseFloat(it.up)||0))}</td>
    </tr>`;
  }).join('');

  // Deliveries
  const deliveriesHtml = (so.deliveries||[]).length
    ? (so.deliveries||[]).map((d,i)=>{
        const confirmed = d.customerConfirmed;
        const dnStatus=getDNStatus(d);
        const statusPill = confirmed
          ? `<span style="background:var(--green-bg);color:var(--green-txt);border:1px solid #b8dacc;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:600">✓ ${dnStatus}</span>`
          : `<span style="background:#fff0e6;color:#b45309;border:1px solid #fcd4a8;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:600">⏳ Out for delivery</span>`;
        return `<div class="inv-card" style="background:${confirmed?'#f0fff4':'#fff8f0'};border-color:${confirmed?'#b8dacc':'#fcd4a8'}">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <button class="btn btn-secondary" style="padding:3px 7px;font-weight:700;font-size:11px" onclick="viewDeliveryNote(\'${so.id}\',${i})"><i class="ti ti-link"></i>${d.dnNo}</button>
              <span style="color:var(--gray);font-size:11px">${fmtDate(d.date)}</span>
              ${statusPill}
            </div>
            <div style="font-size:11px;color:var(--gray)">${d.items.map(it=>`${it.desc} × ${it.qty}`).join(' | ')}</div>
            ${d.customerConfirmedDate?`<div style="font-size:11px;color:var(--green-txt);margin-top:2px">Confirmed: ${fmtDate(d.customerConfirmedDate)}${d.receivedBy?' · Received by '+escapeHtml(d.receivedBy):''}</div>`:''}
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
            <button class="abtn abtn-view" onclick="viewDeliveryNote('${so.id}',${i})"><i class="ti ti-printer"></i>Print DN</button>
            ${!confirmed?`<button class="abtn abtn-edit" style="background:var(--green-bg);color:var(--green-txt);border-color:#b8dacc" onclick="confirmDelivery('${so.id}',${i})"><i class="ti ti-circle-check"></i>Confirm acceptance</button>`:''}
          </div>
        </div>`;
      }).join('')
    : '<p style="font-size:12px;color:var(--gray)">No deliveries dispatched yet.</p>';

  // Invoices
  const invoicesHtml = (so.invoices||[]).length
    ? (so.invoices||[]).map((inv,invoiceIdx)=>`
        <div class="inv-card">
          <div>
            <div style="font-weight:600;font-size:12px"><button class="btn btn-secondary" style="padding:3px 7px;font-weight:700;font-size:11px" onclick="openInvoiceDocument('${so.id}',${invoiceIdx})"><i class="ti ti-link"></i>${inv.invNo}</button> <span style="font-weight:400;color:var(--gray)">· ${fmtDate(inv.date)}</span></div>
            <div style="font-size:11px;color:var(--gray);margin-top:2px">Zoho: ${inv.zohoNo||'—'} · Due: ${fmtDate(inv.dueDate)} · Total: ${fmt(inv.total)}</div>
          </div>
        </div>`).join('')
    : '<p style="font-size:12px;color:var(--gray)">No invoice created yet.</p>';

  // Payments
  const paymentsHtml = (so.payments||[]).length
    ? (so.payments||[]).map(p=>`
        <div class="pay-card">
          <div><span style="font-weight:600">${fmt(p.amount)}</span> · ${p.method} · ${fmtDate(p.date)}</div>
          <div style="color:var(--gray)">${p.ref||''} ${p.remarks?'· '+p.remarks:''}</div>
        </div>`).join('')
    : '<p style="font-size:12px;color:var(--gray)">No payments recorded yet.</p>';

  const poAtt=so.poAttachment||null;
  const poAttachmentHtml=poAtt?.url ? `
    <div class="so-po-view-file">
      <div class="so-po-view-icon"><i class="ti ti-file-description"></i></div>
      <button type="button" class="so-po-view-name" onclick="soViewPOAttachment('${so.id}')" title="View Customer PO"><strong>${escapeHtml(poAtt.name||'Customer PO attachment')}</strong><span>${escapeHtml(soAttachmentMeta(poAtt))}</span></button>
      <div class="so-po-view-actions"><button class="btn btn-secondary btn-sm" onclick="soViewPOAttachment('${so.id}')"><i class="ti ti-eye"></i>View</button><button class="btn btn-secondary btn-sm" onclick="soDownloadPOAttachment('${so.id}')"><i class="ti ti-download"></i>Download</button></div>
    </div>` : '<div class="so-po-view-empty"><i class="ti ti-paperclip-off"></i><span>No Customer PO attachment added.</span></div>';

  document.getElementById('so-view-title').textContent = so.soNo + ' — ' + so.customer;
  document.getElementById('so-view-body').innerHTML = `
    <!-- Header info -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px">
      <div>
        <div class="section-title" style="margin-top:0">Order info</div>
        <div class="detail-row"><span class="dk">Customer</span><strong>${so.customer}</strong></div>
        <div class="detail-row"><span class="dk">Customer PO No</span><strong style="color:var(--blue)">${escapeHtml(so.poNo||'—')}</strong></div>
        <div class="detail-row"><span class="dk">Customer PO Date</span><span>${so.poDate?fmtDate(so.poDate):'—'}</span></div>
        <div class="detail-row"><span class="dk">Linked quotation</span>${q?`<button class="btn btn-secondary" style="padding:4px 8px" onclick="openQuotationDocument('${q.id}')"><i class="ti ti-link"></i>${q.qno}</button>`:'<span>—</span>'}</div>
        <div class="detail-row"><span class="dk">SO date</span><span>${fmtDate(so.date)}</span></div>
        ${so.notes?`<div class="detail-row"><span class="dk">Notes</span><span>${so.notes}</span></div>`:''}
      </div>
      <div>
        <div class="section-title" style="margin-top:0">Financial summary</div>
        <div class="detail-row"><span class="dk">Sub-total</span><span>${fmt(so.subtotal)}</span></div>
        <div class="detail-row"><span class="dk">VAT (${Math.round((so.vatRate||0.15)*100)}%)</span><span>${fmt(so.vat)}</span></div>
        <div class="detail-row"><span class="dk">Order total</span><strong style="color:var(--blue)">${fmt(so.total)}</strong></div>
        <div class="detail-row"><span class="dk">Total paid</span><strong style="color:var(--green)">${fmt(totalPaid)}</strong></div>
        <div class="detail-row"><span class="dk">Outstanding</span><strong style="color:${outstanding>0.01?'var(--red)':'var(--green)'}">${outstanding>0.01?fmt(outstanding):'Fully paid ✓'}</strong></div>
      </div>
      <div>
        <div class="section-title" style="margin-top:0">Progress</div>
        <div class="detail-row"><span class="dk">Deliveries</span><span>${(so.deliveries||[]).length} made</span></div>
        <div class="detail-row"><span class="dk">Invoices</span><span>${(so.invoices||[]).length} issued</span></div>
        <div class="detail-row"><span class="dk">Payments</span><span>${(so.payments||[]).length} received</span></div>
      </div>
    </div>

    <section class="so-po-view-card">
      <div class="so-po-view-head"><span><i class="ti ti-file-invoice"></i>Customer Purchase Order</span><span class="so-po-view-ref">${escapeHtml(so.poNo||'No PO number')}</span></div>
      <div class="so-po-view-details"><div><span>PO Number</span><strong>${escapeHtml(so.poNo||'—')}</strong></div><div><span>PO Date</span><strong>${so.poDate?fmtDate(so.poDate):'—'}</strong></div></div>
      ${poAttachmentHtml}
    </section>

    ${q ? buildDocumentFlowHtml(q, so) : ''}

    <!-- Items -->
    <div class="section-title">Order items</div>
    ${deliveryProgressSummary}
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
      <thead><tr style="background:var(--blue);color:#fff">
        <th style="padding:7px 10px">#</th>
        <th style="padding:7px 10px;text-align:left">Description</th>
        <th style="padding:7px 10px;text-align:center">Ordered</th>
        <th style="padding:7px 10px;text-align:center">Delivered</th>
        <th style="padding:7px 10px;text-align:center">In Transit</th>
        <th style="padding:7px 10px;text-align:center">Remaining</th>
        <th style="padding:7px 10px;text-align:center">UOM</th>
        <th style="padding:7px 10px;text-align:center">Delivery</th>
        <th style="padding:7px 10px;text-align:right">Unit price</th>
        <th style="padding:7px 10px;text-align:right">Total</th>
      </tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>


    <!-- Deliveries -->
    <div class="section-title">Delivery history</div>
    <div style="margin-bottom:16px">${deliveriesHtml}</div>

    <!-- Invoices -->
    <div class="section-title">Invoice history</div>
    <div style="margin-bottom:16px">${invoicesHtml}</div>

    <!-- Payments -->
    <div class="section-title">Payment history</div>
    <div>${paymentsHtml}</div>`;

  // Check if any items still need dispatching
  const dispatchedQty = {};
  (so.deliveries||[]).forEach(d => {
    (d.items||[]).forEach(it => {
      const idx = it.origIdx !== undefined ? it.origIdx : it.soIdx;
      dispatchedQty[idx] = (dispatchedQty[idx]||0) + (parseFloat(it.qty)||0);
    });
  });
  const hasUndelivered = (so.items||[]).some((it,i) => {
    const dispatched = dispatchedQty[it.origIdx!==undefined?it.origIdx:i]||0;
    return (parseFloat(it.qty)||0) - dispatched > 0.001;
  });

  // Footer buttons
  const fBtns = [];
  fBtns.push('<button class="btn btn-secondary" onclick="closeModal(\'so-view-modal\')">Close</button>');
  if (!soHasDownstreamActivity(so)) {
    fBtns.push(`<button class="btn btn-secondary" data-sid="${so.id}" onclick="openEditSO(this.dataset.sid)"><i class="ti ti-edit"></i>Edit Order</button>`);
    fBtns.push(`<button class="btn btn-danger" data-sid="${so.id}" onclick="deleteSalesOrder(this.dataset.sid)"><i class="ti ti-trash"></i>Delete Order</button>`);
  }
  if (hasUndelivered) {
    fBtns.push(`<button class="btn btn-secondary" data-sid="${so.id}" onclick="openRecordDelivery(this.dataset.sid)"><i class="ti ti-truck"></i>Dispatch delivery</button>`);
  }
  if ((so.deliveries||[]).some(d=>d.customerConfirmed) && !(so.invoices||[]).length) {
    fBtns.push(`<button class="btn btn-secondary" data-sid="${so.id}" onclick="openCreateInvoice(this.dataset.sid)"><i class="ti ti-file-invoice"></i>Create invoice</button>`);
  }
  if ((so.invoices||[]).length > 0 && outstanding > 0.01) {
    fBtns.push(`<button class="btn btn-success" data-sid="${so.id}" onclick="openRecordPayment(this.dataset.sid)"><i class="ti ti-cash"></i>Record payment</button>`);
  }
  document.getElementById('so-view-footer').innerHTML = fBtns.join('');
  openModalWithSize('so-view-modal');
}

/* ── Delivery Notes v125 ── */
function deliveryActor(){return (window.currentUser&&(window.currentUser.name||window.currentUser.email))||'Authenticated user';}
function deliveryAcceptedQty(d,it){return d.customerConfirmed ? (it.acceptedQty!=null?Number(it.acceptedQty):Number(it.qty)||0) : 0;}
function deliveryRejectedQty(d,it){return d.customerConfirmed ? (Number(it.rejectedQty)||0) : 0;}
function getDNStatus(d){
  if(!d.customerConfirmed) return 'Out for Delivery';
  let a=0,r=0; (d.items||[]).forEach(it=>{a+=deliveryAcceptedQty(d,it);r+=deliveryRejectedQty(d,it)});
  if(r<=0) return 'Delivered'; if(a<=0) return 'Rejected'; return 'Partially Accepted';
}
function allDeliveryNotes(){const rows=[];salesOrders.forEach(so=>(so.deliveries||[]).forEach((d,i)=>rows.push({so,d,i,status:getDNStatus(d)})));return rows;}
function renderDNPage(){
  const body=document.getElementById('dn-register-tbody');if(!body)return;
  const q=(document.getElementById('dn-search')?.value||'').toLowerCase(); const st=document.getElementById('dn-status-filter')?.value||'';
  let rows=allDeliveryNotes().filter(x=>(!st||x.status===st)&&(!q||`${x.d.dnNo} ${x.so.soNo} ${x.so.customer} ${x.so.poNo}`.toLowerCase().includes(q))).sort((a,b)=>(b.d.date||'').localeCompare(a.d.date||''));
  body.innerHTML=rows.length?rows.map(x=>`<tr class="quotation-clickable-row" onclick="viewDeliveryNote('${x.so.id}',${x.i})"><td><strong>${escapeHtml(x.d.dnNo||'—')}</strong></td><td>${fmtDate(x.d.date)}</td><td>${escapeHtml(x.so.customer||'—')}</td><td>${escapeHtml(x.so.soNo||'—')}</td><td>${escapeHtml(x.so.poNo||'—')}</td><td>${(x.d.items||[]).length}</td><td><span class="badge ${x.status==='Delivered'?'won':x.status==='Partially Accepted'?'pending':x.status==='Rejected'?'lost':'sent'}">${x.status}</span></td></tr>`).join(''):'<tr><td colspan="7" style="text-align:center;color:var(--gray);padding:30px">No delivery notes found.</td></tr>';
}
function openRecordDelivery(soId) {
  const so=salesOrders.find(x=>x.id===soId);if(!so)return;currentSOId=soId;
  document.getElementById('dn-title').textContent='Create Delivery Note — '+so.soNo;document.getElementById('dn-no').value='Auto on Save';document.getElementById('dn-date').value=new Date().toISOString().split('T')[0];document.getElementById('dn-vehicle').value='';document.getElementById('dn-remarks').value='';document.getElementById('dn-po').value=so.poNo||'—';document.getElementById('dn-so-ref').value=so.soNo||'—';
  const accepted={};(so.deliveries||[]).forEach(d=>(d.items||[]).forEach(it=>{const idx=it.origIdx!==undefined?it.origIdx:it.soIdx;accepted[idx]=roundQtyForUom((accepted[idx]||0)+deliveryAcceptedQty(d,it),it.uom)}));
  const transit={};(so.deliveries||[]).filter(d=>!d.customerConfirmed).forEach(d=>(d.items||[]).forEach(it=>{const idx=it.origIdx!==undefined?it.origIdx:it.soIdx;transit[idx]=roundQtyForUom((transit[idx]||0)+(Number(it.qty)||0),it.uom)}));
  const remaining=(so.items||[]).map((it,i)=>{const idx=it.origIdx!==undefined?it.origIdx:i;const rem=roundQtyForUom(Math.max(0,(Number(it.qty)||0)-(accepted[idx]||0)-(transit[idx]||0)),it.uom);return {...it,soIdx:i,origIdx:idx,acceptedQty:accepted[idx]||0,remainingQty:rem}}).filter(it=>it.remainingQty>0);
  if(!remaining.length){showToast('No quantity is available for dispatch','warning');return;}
  const modal=document.getElementById('so-delivery-modal');modal._soId=soId;modal._remainingItems=remaining;
  document.getElementById('dn-items-list').innerHTML=remaining.map((it,i)=>`<tr><td class="center">${i+1}</td><td><strong>${escapeHtml(it.desc||'—')}</strong></td><td class="center">${it.qty}</td><td class="center">${it.acceptedQty}</td><td class="center"><input class="so-qty-input" id="dn-qty-${i}" type="number" value="${it.remainingQty}" min="0" max="${it.remainingQty}" step="${qtyStep(it.uom)}" oninput="updateDNRemaining(${i})"></td><td class="center"><strong id="dn-rem-${i}">0</strong></td><td class="center">${escapeHtml(it.uom||'—')}</td></tr>`).join('');
  openModalWithSize('so-delivery-modal');
}
function updateDNRemaining(i){const m=document.getElementById('so-delivery-modal'),it=(m._remainingItems||[])[i];if(!it)return;let q=roundQtyForUom(document.getElementById('dn-qty-'+i)?.value,it.uom);q=Math.max(0,Math.min(q,it.remainingQty));document.getElementById('dn-rem-'+i).textContent=roundQtyForUom(it.remainingQty-q,it.uom);}
async function saveDelivery(){
 const m=document.getElementById('so-delivery-modal'),so=salesOrders.find(x=>x.id===m._soId);if(!so)return;const date=document.getElementById('dn-date').value;if(!date){showToast('Please enter DN date','error');return}
 const items=[];(m._remainingItems||[]).forEach((it,i)=>{let qty=roundQtyForUom(document.getElementById('dn-qty-'+i)?.value,it.uom);if(qty>it.remainingQty)qty=it.remainingQty;if(qty>0)items.push({...it,qty,acceptedQty:null,rejectedQty:null})});if(!items.length){showToast('Enter at least one delivery quantity','error');return}
 const dnNo=await allocateDocumentNumber('deliveryNote',new Date(date+'T00:00:00'));const d={id:'DN-'+Date.now(),dnNo,date,status:'Out for Delivery',vehicle:document.getElementById('dn-vehicle').value.trim(),remarks:document.getElementById('dn-remarks').value.trim(),items,dispatchedAt:new Date().toISOString(),dispatchedBy:deliveryActor(),created:new Date().toISOString()};so.deliveries=so.deliveries||[];so.deliveries.push(d);await saveSalesOrders();closeModal('so-delivery-modal');showToast(dnNo+' saved and dispatched','success');renderSOPage();renderDNPage();viewSO(so.id);
}
function canConfirmDelivery(d){
  if(!window.currentUser) return {ok:false,msg:'Please sign in to BizCore.'};
  return {ok:true};
}
function openDeliveryAcceptance(soId,deliveryIdx){
 const so=salesOrders.find(x=>x.id===soId),d=so?.deliveries?.[deliveryIdx];if(!d)return;if(d.customerConfirmed){showToast('This delivery is already confirmed','info');return}
 const authz=canConfirmDelivery(d);if(!authz.ok){showToast(authz.msg,'error');return}
 document.getElementById('dn-confirm-title').textContent=d.dnNo+' — Confirm Delivery';document.getElementById('dn-confirm-sub').textContent=`${so.customer} · ${so.soNo}`;document.getElementById('dn-auth-user').textContent='Signed in as '+deliveryActor();document.getElementById('dn-received-by').value='';document.getElementById('dn-customer-remarks').value='';
 const box=document.getElementById('dn-confirm-items');box.innerHTML=(d.items||[]).map((it,i)=>`<div class="dn-accept-card"><div class="dn-accept-head"><span>${i+1}. ${escapeHtml(it.desc||'—')}</span><strong>${it.qty} ${escapeHtml(it.uom||'')}</strong></div><div class="dn-accept-grid"><label>Accepted Qty<input type="number" id="dn-acc-${i}" value="${it.qty}" min="0" max="${it.qty}" step="${qtyStep(it.uom)}" oninput="syncDNReject(${i})"></label><label>Rejected Qty<input type="number" id="dn-rej-${i}" value="0" min="0" max="${it.qty}" step="${qtyStep(it.uom)}" oninput="syncDNAccept(${i})"></label><label id="dn-reason-wrap-${i}" style="display:none">Rejection Reason<select id="dn-reason-${i}"><option value="">Select reason…</option><option>Damaged</option><option>Specification mismatch</option><option>Wrong item</option><option>Excess quantity</option><option>Quality issue</option><option>Customer requested return</option><option>Packaging damaged</option><option>Other</option></select></label><label id="dn-disposition-wrap-${i}" style="display:none">Disposition<select id="dn-disposition-${i}"><option>Returned with Driver</option><option>Left at Customer Site</option><option>Replacement Required</option><option>Under Review</option></select></label></div><input id="dn-line-remarks-${i}" class="dn-line-remarks" placeholder="Rejection / line remarks (optional)" style="display:none"></div>`).join('');
 const modal=document.getElementById('dn-confirm-modal');
 if(!modal){showToast('Delivery Confirmation screen is unavailable','error');return false;}
 modal._soId=soId;modal._deliveryIdx=deliveryIdx;
 openModalWithSize('dn-confirm-modal');
 return modal.classList.contains('open');
}
function syncDNReject(i){const m=document.getElementById('dn-confirm-modal'),d=salesOrders.find(x=>x.id===m._soId)?.deliveries?.[m._deliveryIdx],it=d?.items?.[i];if(!it)return;let a=Math.max(0,Math.min(Number(document.getElementById('dn-acc-'+i).value)||0,Number(it.qty)||0));document.getElementById('dn-rej-'+i).value=roundQtyForUom((Number(it.qty)||0)-a,it.uom);toggleDNRejectFields(i)}
function syncDNAccept(i){const m=document.getElementById('dn-confirm-modal'),d=salesOrders.find(x=>x.id===m._soId)?.deliveries?.[m._deliveryIdx],it=d?.items?.[i];if(!it)return;let r=Math.max(0,Math.min(Number(document.getElementById('dn-rej-'+i).value)||0,Number(it.qty)||0));document.getElementById('dn-acc-'+i).value=roundQtyForUom((Number(it.qty)||0)-r,it.uom);toggleDNRejectFields(i)}
function toggleDNRejectFields(i){const r=Number(document.getElementById('dn-rej-'+i)?.value)||0;['reason-wrap','disposition-wrap'].forEach(x=>{const e=document.getElementById('dn-'+x+'-'+i);if(e)e.style.display=r>0?'flex':'none'});const n=document.getElementById('dn-line-remarks-'+i);if(n)n.style.display=r>0?'block':'none'}
async function saveDeliveryAcceptance(){
 const m=document.getElementById('dn-confirm-modal'),so=salesOrders.find(x=>x.id===m._soId),d=so?.deliveries?.[m._deliveryIdx];if(!d)return;const receivedBy=document.getElementById('dn-received-by').value.trim();if(!receivedBy){showToast('Received By is required','error');return}
 for(let i=0;i<d.items.length;i++){const it=d.items[i],qty=Number(it.qty)||0,a=roundQtyForUom(document.getElementById('dn-acc-'+i).value,it.uom),r=roundQtyForUom(document.getElementById('dn-rej-'+i).value,it.uom);if(Math.abs((a+r)-qty)>0.001){showToast(`Line ${i+1}: Accepted + Rejected must equal delivery quantity`,'error');return}const reason=document.getElementById('dn-reason-'+i)?.value||'';if(r>0&&!reason){showToast(`Line ${i+1}: Select a rejection reason`,'error');return}it.acceptedQty=a;it.rejectedQty=r;it.rejectionReason=r>0?reason:'';it.rejectionDisposition=r>0?(document.getElementById('dn-disposition-'+i)?.value||''):'';it.acceptanceRemarks=document.getElementById('dn-line-remarks-'+i)?.value.trim()||''}
 d.customerConfirmed=true;d.customerConfirmedDate=new Date().toISOString().split('T')[0];d.confirmedAt=new Date().toISOString();d.confirmedBy=deliveryActor();d.receivedBy=receivedBy;d.customerRemarks=document.getElementById('dn-customer-remarks').value.trim();d.status=getDNStatus(d);await saveSalesOrders();closeModal('dn-confirm-modal');renderSOPage();renderDNPage();viewSO(so.id);showToast(`${d.dnNo} confirmed — ${d.status}`,'success');
}
async function confirmDelivery(soId,deliveryIdx){openDeliveryAcceptance(soId,deliveryIdx)}
function getDNDeepLink(d){const base=location.href.split('?')[0].split('#')[0];return base+'?dn='+encodeURIComponent(d.id)}
function renderDNQRCode(d){setTimeout(()=>{const el=document.getElementById('dn-qr-code');if(!el)return;el.innerHTML='';if(window.QRCode){new QRCode(el,{text:getDNDeepLink(d),width:112,height:112,correctLevel:QRCode.CorrectLevel.M})}else{el.innerHTML='<div style="font-size:10px;color:#777;width:112px">QR library unavailable. Use the delivery link from BizCore.</div>'}},0)}
function openDNFromDeepLink(){
 const id=new URLSearchParams(location.search).get('dn');
 if(!id || window._dnDeepLinkOpened===id || window._dnDeepLinkRouting===id) return false;
 // Authentication and authoritative Firebase SO/DN data must both be ready.
 if(!window.currentUser || !Array.isArray(salesOrders)) return false;
 const hit=allDeliveryNotes().find(x=>x.d.id===id);
 if(!hit) return false;

 // v128: the QR destination is the exact DN workspace, not merely the DN register.
 // Render the register only as the background module, then open the requested DN
 // after that render has completed. Do not mark the deep link as consumed until
 // the target modal is actually open.
 window._dnDeepLinkRouting=id;
 showPage('deliverynotes');
 setTimeout(()=>{
   try{
     if(hit.d.customerConfirmed) viewDeliveryNote(hit.so.id,hit.i);
     else openDeliveryAcceptance(hit.so.id,hit.i);

     const targetId=hit.d.customerConfirmed?'dn-print-modal':'dn-confirm-modal';
     const target=document.getElementById(targetId);
     if(target && target.classList.contains('open')){
       window._dnDeepLinkOpened=id;
     }else{
       // Allow the startup retry loop / Firebase listener to try again.
       window._dnDeepLinkOpened=null;
     }
   }finally{
     window._dnDeepLinkRouting=null;
   }
 },80);
 return true;
}
/* ── View / Print Delivery Note ── */
function viewDeliveryNote(soId, deliveryIdx) {
  const so = salesOrders.find(x=>x.id===soId); if (!so) return;
  const d = so.deliveries[deliveryIdx]; if (!d) return;
  const dnViewModal = document.getElementById('dn-print-modal');
  if (dnViewModal) { dnViewModal._soId = soId; dnViewModal._deliveryIdx = deliveryIdx; }
  const confirmBtn = document.getElementById('dn-open-confirm-btn');
  if (confirmBtn) {
    confirmBtn.style.display = 'inline-flex';
    confirmBtn.disabled = !!d.customerConfirmed;
    confirmBtn.innerHTML = d.customerConfirmed
      ? '<i class="ti ti-circle-check"></i>Delivery Confirmed'
      : '<i class="ti ti-device-mobile-check"></i>Delivery Confirmation';
  }
  const co = settings.coname||'Downtown Trading Est.';
  const q = quotations.find(x=>x.id===so.quotationId);

  const itemRows = d.items.map((it,i)=>`
    <tr>
      <td style="padding:8px 10px;border:1px solid #ddd">${i+1}</td>
      <td style="padding:8px 10px;border:1px solid #ddd">${it.desc||'—'}</td>
      <td style="padding:8px 10px;border:1px solid #ddd;text-align:center">${it.qty}</td>
      <td style="padding:8px 10px;border:1px solid #ddd;text-align:center">${it.uom||'—'}</td>
      <td style="padding:8px 10px;border:1px solid #ddd">____________________________</td>
    </tr>`).join('');

  document.getElementById('dn-print-title').textContent = d.dnNo;
  document.getElementById('dn-print-body').innerHTML = `
    <div style="padding:32px;font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a">
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #1F4E79">
        <div>
          <div style="font-size:22px;font-weight:700;color:#1F4E79">${co}</div>
          <div style="font-size:12px;color:#666;margin-top:4px">${settings.address||''}</div>
          <div style="font-size:12px;color:#666">${settings.phone||''} · ${settings.email||''}</div>
          ${settings.vat?`<div style="font-size:12px;color:#666">VAT Reg: ${settings.vat}</div>`:''}
        </div>
        <div style="text-align:right">
          <div style="font-size:26px;font-weight:800;color:#1F4E79;letter-spacing:1px">DELIVERY NOTE</div>
          <div style="font-size:16px;font-weight:700;margin-top:4px">${d.dnNo}</div>
          <div style="font-size:12px;color:#666;margin-top:2px">Date: ${fmtDate(d.date)}</div>
        </div>
      </div>

      <!-- Reference Info -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
        <div style="border:1px solid #ddd;border-radius:6px;padding:14px">
          <div style="font-size:11px;font-weight:700;color:#666;text-transform:uppercase;margin-bottom:8px">Deliver to</div>
          <div style="font-weight:600;font-size:14px">${so.customer}</div>
        </div>
        <div style="border:1px solid #ddd;border-radius:6px;padding:14px">
          <div style="font-size:11px;font-weight:700;color:#666;text-transform:uppercase;margin-bottom:8px">Reference</div>
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="color:#666">Sales Order:</span><strong>${so.soNo}</strong></div>
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="color:#666">Customer PO:</span><strong>${so.poNo||'—'}</strong></div>
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="color:#666">Quotation:</span><strong>${q?q.qno:'—'}</strong></div>
          ${d.vehicle?`<div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:#666">Vehicle/AWB:</span><strong>${d.vehicle}</strong></div>`:''}
        </div>
      </div>

      <!-- Items Table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead>
          <tr style="background:#1F4E79;color:#fff">
            <th style="padding:9px 10px;border:1px solid #1F4E79;text-align:left;width:36px">#</th>
            <th style="padding:9px 10px;border:1px solid #1F4E79;text-align:left">Description</th>
            <th style="padding:9px 10px;border:1px solid #1F4E79;text-align:center;width:60px">Qty</th>
            <th style="padding:9px 10px;border:1px solid #1F4E79;text-align:center;width:60px">UOM</th>
            <th style="padding:9px 10px;border:1px solid #1F4E79;text-align:left;width:200px">Received by (signature)</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      ${d.remarks?`<div style="margin-bottom:20px;padding:10px 14px;background:#fffbea;border:1px solid #ffc107;border-radius:6px;font-size:12px"><strong>Remarks:</strong> ${d.remarks}</div>`:''}

      <div style="display:flex;justify-content:space-between;align-items:center;gap:20px;margin:18px 0;padding:12px 14px;border:1px solid #dbe5ef;border-radius:7px;background:#f8fbff">
        <div style="flex:1"><strong style="color:#1F4E79">Mobile Delivery Confirmation</strong><div style="font-size:11px;color:#666;margin-top:4px">Authorized BizCore users can scan this QR to update customer acceptance. Login is required.</div>${d.customerConfirmed?'<div style="margin-top:10px;font-size:12px;font-weight:700;color:#15803d">✓ Delivery already confirmed</div>':'<button type="button" class="btn btn-success btn-sm" style="margin-top:10px" onclick="openDeliveryConfirmationFromDNView()"><i class="ti ti-device-mobile-check"></i> Open Delivery Confirmation</button>'}</div>
        <div id="dn-qr-code" style="width:112px;height:112px;flex:0 0 112px"></div>
      </div>

      <!-- Signature Block -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:32px">
        <div style="border-top:1px solid #1a1a1a;padding-top:8px">
          <div style="font-size:11px;color:#666">Delivered by (name &amp; signature)</div>
          <div style="margin-top:20px;font-size:11px;color:#666">Date: _________________________</div>
        </div>
        <div style="border-top:1px solid #1a1a1a;padding-top:8px">
          <div style="font-size:11px;color:#666">Received by (name &amp; signature)</div>
          <div style="margin-top:20px;font-size:11px;color:#666">Date: _________________________</div>
        </div>
      </div>

      <div style="margin-top:24px;text-align:center;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:12px">
        ${co} · Generated by BizCore · ${new Date().toLocaleDateString('en-GB')}
      </div>
    </div>`;

  renderDNQRCode(d);
  openModalWithSize('dn-print-modal');
}


function openDeliveryConfirmationFromDNView(){
  const viewModal=document.getElementById('dn-print-modal');
  const soId=viewModal?._soId, deliveryIdx=viewModal?._deliveryIdx;
  if(soId==null || deliveryIdx==null){showToast('Unable to identify this Delivery Note','error');return;}

  // Open the confirmation workspace FIRST while the source DN still owns its
  // record context. Only then hide the DN View. This avoids losing/interrupting
  // the transition between two modal workspaces.
  try{
    const opened=openDeliveryAcceptance(soId,deliveryIdx);
    const confirmModal=document.getElementById('dn-confirm-modal');
    if(opened && confirmModal?.classList.contains('open')){
      viewModal?.classList.remove('open','modal-fs-overlay');
      updateFullscreenShellState();
      // Keep the confirmation workspace above any other modal remnants.
      confirmModal.style.zIndex='6200';
      return;
    }
    showToast('Could not open Delivery Confirmation','error');
  }catch(err){
    console.error('Delivery Confirmation open failed',err);
    showToast('Could not open Delivery Confirmation: '+(err?.message||'Unknown error'),'error');
  }
}

function printDeliveryNote() {
  const qr=document.querySelector('#dn-qr-code canvas');if(qr){const holder=document.getElementById('dn-qr-code');holder.innerHTML=`<img src="${qr.toDataURL('image/png')}" style="width:112px;height:112px" alt="Delivery QR">`;}
  const body = document.getElementById('dn-print-body').innerHTML;
  const w = window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>Delivery Note</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
    </head><body>${body}<scr'+'ipt>window.onload=()=>{window.print();window.close();}<'+'/script></body></html>`);
  w.document.close();
}

/* ── Create Invoice ── */
function openCreateInvoice(soId) {
  const so = salesOrders.find(x=>x.id===soId); if (!so) return;
  currentSOId = soId;
  const invNo = 'Auto on Save';
  const today = new Date().toISOString().split('T')[0];
  const dueDate = new Date(); dueDate.setDate(dueDate.getDate()+14);
  const dueDateStr = dueDate.toISOString().split('T')[0];

  document.getElementById('inv-modal-title').textContent = 'Create Invoice — ' + so.soNo;
  document.getElementById('inv-no').value = invNo;
  document.getElementById('inv-date').value = today;
  document.getElementById('inv-zoho').value = '';
  document.getElementById('inv-due').value = dueDateStr;
  document.getElementById('inv-notes').value = '';
  document.getElementById('inv-sum-sub').textContent = documentMoney('customerInvoice','summary',so.subtotal);
  document.getElementById('inv-sum-vat').textContent = documentMoney('customerInvoice','summary',so.vat);
  document.getElementById('inv-sum-vat-label').textContent = 'VAT (' + Math.round((so.vatRate||0.15)*100) + '%)';
  document.getElementById('inv-sum-total').textContent = documentMoney('customerInvoice','grandTotal',so.total);
  document.getElementById('so-invoice-modal')._soId = soId;
  openModalWithSize('so-invoice-modal');
}

async function saveInvoice() {
  const modal = document.getElementById('so-invoice-modal');
  const soId = modal._soId;
  const so = salesOrders.find(x=>x.id===soId); if (!so) return;
  const date = document.getElementById('inv-date').value;
  if (!date) { showToast('Please enter invoice date','error'); return; }

  const invNumber=await allocateDocumentNumber('customerInvoice',new Date(date+'T00:00:00'));
  const inv = {
    invNo:   invNumber,
    zohoNo:  document.getElementById('inv-zoho').value.trim(),
    date,
    dueDate: document.getElementById('inv-due').value,
    notes:   document.getElementById('inv-notes').value.trim(),
    subtotal:so.subtotal,
    vat:     so.vat,
    total:   so.total,
    created: new Date().toISOString(),
  };
  so.invoices.push(inv);
  await saveSalesOrders();
  closeModal('so-invoice-modal');
  showToast('Invoice ' + inv.invNo + ' created', 'success');
  renderSOPage();
  viewSO(soId);
}

/* ── Record Payment ── */
function openRecordPayment(soId) {
  const so = salesOrders.find(x=>x.id===soId); if (!so) return;
  currentSOId = soId;
  const totalPaid = (so.payments||[]).reduce((s,p)=>s+(parseFloat(p.amount)||0),0);
  const outstanding = so.total - totalPaid;
  document.getElementById('pay-modal-title').textContent = 'Record Payment — ' + so.soNo;
  document.getElementById('pay-outstanding-info').innerHTML =
    `<strong>Invoice total:</strong> ${fmt(so.total)} &nbsp;·&nbsp; <strong>Paid so far:</strong> ${fmt(totalPaid)} &nbsp;·&nbsp; <strong>Outstanding:</strong> <span style="color:var(--red);font-weight:700">${fmt(outstanding)}</span>`;
  document.getElementById('pay-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('pay-amount').value = outstanding.toFixed(2);
  document.getElementById('pay-method').value = 'Bank transfer';
  document.getElementById('pay-ref').value = '';
  document.getElementById('pay-remarks').value = '';
  document.getElementById('so-payment-modal')._soId = soId;
  document.getElementById('so-payment-modal')._outstanding = outstanding;
  updatePaymentBalance();
  openModalWithSize('so-payment-modal');
}

function updatePaymentBalance() {
  const modal = document.getElementById('so-payment-modal');
  const outstanding = modal._outstanding||0;
  const amount = parseFloat(document.getElementById('pay-amount')?.value)||0;
  const remaining = outstanding - amount;
  const info = document.getElementById('pay-balance-info');
  if (info) {
    if (remaining < -0.01) {
      info.innerHTML = `<span style="color:var(--red)">⚠ Amount exceeds outstanding by ${fmt(Math.abs(remaining))}</span>`;
    } else if (remaining < 0.01) {
      info.innerHTML = `<span style="color:var(--green)">✓ Full payment — order will be marked as Paid</span>`;
    } else {
      info.innerHTML = `Remaining after this payment: <strong style="color:var(--orange-txt)">${fmt(remaining)}</strong> — order will be marked as Partially Paid`;
    }
  }
}

async function savePayment() {
  const modal = document.getElementById('so-payment-modal');
  const soId = modal._soId;
  const so = salesOrders.find(x=>x.id===soId); if (!so) return;
  const date = document.getElementById('pay-date').value;
  const amount = parseFloat(document.getElementById('pay-amount').value)||0;
  if (!date) { showToast('Please enter payment date','error'); return; }
  if (amount <= 0) { showToast('Please enter a valid payment amount','error'); return; }

  const payment = {
    id:      'PAY-' + Date.now(),
    date,
    amount,
    method:  document.getElementById('pay-method').value,
    ref:     document.getElementById('pay-ref').value.trim(),
    remarks: document.getElementById('pay-remarks').value.trim(),
    created: new Date().toISOString(),
  };
  so.payments.push(payment);
  await saveSalesOrders();
  closeModal('so-payment-modal');
  const newStatus = getSOStatus(so);
  showToast('Payment recorded — Order is now ' + newStatus, 'success');
  renderSOPage();
  viewSO(soId);
}

/* ══════════════════════════════════════════════════
   PRINT TEMPLATE SYSTEM
══════════════════════════════════════════════════ */
let _printQID = null;

const TEMPLATES = [
  { id:'erpbox',       name:'Product', desc:'Best for product supply quotations with item code, description, quantity and pricing.', badge:'Recommended' },
  { id:'servicequote', name:'Contracting', desc:'Best for civil, MEP, HVAC, installation, maintenance and project works.' },
  { id:'erpbilingual', name:'Arabic / English', desc:'Bilingual quotation layout for Saudi Arabia with Arabic and English labels.' },
  { id:'imageref',     name:'Item Image – Thumbnail', desc:'Compact image reference for quotations with many line items.' },
  { id:'imagerefmed',  name:'Item Image – Medium', desc:'Shows each product image at 4 × 3 cm for clearer visual identification.' },
  { id:'imagereflarge',name:'Item Image – Large', desc:'Shows each product image at 6 × 5 cm for equipment, furniture and technical items.' },
  { id:'imagerefattach',name:'Item Image – Attachment', desc:'Keeps the quotation table clean and adds product image references as an attachment section.' }
];

const TPL_PREVIEWS = {
  professional: `<div style="background:#0B539D;height:28px;display:flex;align-items:center;padding:0 8px;border-bottom:3px solid #F15A25"><div style="background:#fff;border-radius:3px;padding:1px 5px;font-size:7px;font-weight:800;color:#0B539D">DOWNTOWN</div><div style="margin-left:auto;text-align:right"><div style="background:#F15A25;color:#fff;font-size:8px;padding:1px 4px;border-radius:2px;font-weight:800">QUOTATION</div><div style="color:#fff;font-size:8px;font-weight:800">Q-2606-001</div></div></div><div style="background:#f8f9fa;padding:4px 8px;font-size:7px;border-bottom:1px solid #eee"><b style="color:#0B539D">SD Middle East LLC</b> &nbsp;·&nbsp; Ref: — &nbsp;·&nbsp; 7 days</div><div style="padding:3px 8px"><div style="background:#0B539D;color:#fff;font-size:5px;padding:2px 4px">#  DESCRIPTION  QTY  UOM  PRICE  AMOUNT</div><div style="font-size:6px;padding:2px 4px;border-bottom:1px solid #eee">01 &nbsp; Item description &nbsp; 10 &nbsp; Pcs &nbsp; 100.00 &nbsp; 1,000.00</div></div>`,
  classic: `<div style="background:#1a1a1a;height:28px;display:flex;align-items:center;padding:0 8px"><span style="color:#fff;font-size:8px;font-weight:700">DOWNTOWN TRADING EST.</span><div style="margin-left:auto;text-align:right;color:#ccc;font-size:8px;font-weight:700">QUOTATION<br><b style="color:#fff">Q-2606-001</b></div></div><div style="height:2px;background:#c9a227"></div><div style="padding:4px 8px;font-size:7px;border-bottom:1px solid #ddd;display:flex;justify-content:space-between"><span><b>To:</b> Customer Name</span><span><b>Date:</b> 27-06-2026</span></div><div style="padding:3px 8px"><table style="width:100%;font-size:6px;border-collapse:collapse"><tr style="border-bottom:2px solid #1a1a1a"><th style="text-align:left;padding:2px">DESCRIPTION</th><th>QTY</th><th>AMOUNT</th></tr><tr><td style="padding:2px">Item here</td><td style="text-align:center">10</td><td style="text-align:right">1,000.00</td></tr></table></div>`,
  modern: `<div style="background:linear-gradient(120deg,#0B539D,#0a3d72);padding:8px;display:flex;justify-content:space-between;align-items:center"><div style="color:rgba(255,255,255,.6);font-size:6px;letter-spacing:1px">Q U O T A T I O N</div><div style="color:#fff;font-size:16px;font-weight:900">Q-2606-001</div></div><div style="height:3px;background:#F15A25"></div><div style="background:#F0F7FF;padding:4px 8px;font-size:7px;border-bottom:1px solid #D0E4F7"><b style="color:#0B539D">Customer Name</b> &nbsp;·&nbsp; Ref: — &nbsp;·&nbsp; Delivery: 2–4 wks</div><div style="padding:3px 8px"><div style="background:#0B539D;color:#fff;font-size:5px;padding:2px 4px">#  DESCRIPTION  QTY  UOM  PRICE  AMOUNT</div><div style="font-size:6px;padding:2px 4px;background:#F0F7FF">01 &nbsp; Item description &nbsp; 10 &nbsp; Pcs</div></div>`,
  executive: `<div style="height:100%;background:#fff;display:flex;border-left:6px solid #1F4E79"><div style="flex:1;padding:7px 8px"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div style="font-size:8px;font-weight:800;color:#1F4E79">DOWNTOWN TRADING EST.</div><div style="font-size:5px;color:#7b8794;margin-top:1px">Riyadh, Kingdom of Saudi Arabia</div></div><div style="text-align:right"><div style="font-size:7px;letter-spacing:1px;color:#7b8794;font-weight:800">QUOTATION</div><div style="font-size:10px;font-weight:900;color:#1F4E79">Q-2606-001</div></div></div><div style="margin-top:7px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:3px;padding:4px;font-size:6px"><b style="color:#1F4E79">Customer Name</b><span style="float:right;color:#7b8794">Valid 7 days</span></div><div style="margin-top:5px;height:14px;background:linear-gradient(90deg,#EEF4FA 70%,#1F4E79 70%)"></div><div style="margin-top:4px;text-align:right;font-size:7px;font-weight:800;color:#1F4E79">SAR 1,000.00</div></div></div>`,
  erpbox: `<div style="padding:7px 8px;background:#fff"><div style="font-size:9px;font-weight:900;color:#1F4E79;text-align:center;margin-bottom:5px">QUOTATION</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px"><div style="border:1px solid #CBD5E1;border-radius:4px;padding:4px"><div style="font-size:6px;color:#64748B;font-weight:800">CUSTOMER</div><div style="font-size:8px;color:#1F4E79;font-weight:800;margin-top:3px">Customer Name</div><div style="font-size:6px;color:#64748B">Attention: Name</div></div><div style="border:1px solid #CBD5E1;border-radius:4px;padding:4px"><div style="font-size:6px;color:#64748B;font-weight:800">QUOTATION INFORMATION</div><div style="font-size:6px;margin-top:3px"><b>Quotation No.</b> &nbsp; Q-2606-001</div><div style="font-size:6px"><b>Client Ref</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; RFQ-001</div><div style="font-size:6px"><b>Date</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 27-Jun</div></div></div><div style="margin-top:5px;background:#1F4E79;color:#fff;font-size:5px;padding:2px 4px"># DESCRIPTION QTY UOM PRICE AMOUNT</div></div>`,
  premiumcard: `<div style="padding:7px 8px;background:#fff"><div style="font-size:8px;font-weight:800;color:#1F4E79">CUSTOMER</div><div style="font-size:7px;color:#334155;margin:2px 0 5px">Customer Name · Attention: Name</div><div style="text-align:center;font-size:8px;letter-spacing:1px;color:#64748B;font-weight:800;margin-bottom:3px">QUOTATION</div><div style="border:1px solid #CBD5E1;border-radius:5px;padding:5px;background:#F8FAFC;font-size:6px"><div><b>Quotation No.</b> &nbsp; Q-2606-001</div><div><b>Client Ref</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; RFQ-001</div><div><b>Date</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 27-Jun</div><div><b>Valid Until</b> &nbsp;&nbsp; 27-Jul</div></div><div style="margin-top:5px;background:#1F4E79;height:12px;border-radius:2px"></div></div>`,
  executiveinfo: `<div style="padding:7px 8px;background:#fff"><div style="border-top:2px solid #1F4E79;border-bottom:1px solid #CBD5E1;padding:4px 0;text-align:center;font-size:9px;font-weight:900;color:#1F4E79">QUOTATION</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:5px"><div style="border:1px solid #E2E8F0;border-radius:4px;padding:4px;min-height:36px"><div style="font-size:6px;color:#64748B;font-weight:800">CUSTOMER</div><div style="font-size:8px;color:#1F4E79;font-weight:800;margin-top:3px">Customer Name</div><div style="font-size:6px;color:#64748B">Attention: Name</div></div><div style="border:1px solid #E2E8F0;border-radius:4px;padding:4px;min-height:36px"><div style="font-size:6px;color:#64748B;font-weight:800">QUOTATION INFORMATION</div><div style="font-size:6px;margin-top:3px"><b>Quotation No.</b> Q-2606-001</div><div style="font-size:6px"><b>Client Ref</b> RFQ-001</div><div style="font-size:6px"><b>Date</b> 27-Jun</div></div></div><div style="margin-top:5px;background:#F8FAFC;border:1px solid #E2E8F0;height:10px"></div></div>`,
  erpbilingual: `<div style="padding:7px 8px;background:#fff"><div style="font-size:9px;font-weight:900;color:#1F4E79;text-align:center;margin-bottom:5px">QUOTATION / عرض سعر</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px"><div style="border:1px solid #CBD5E1;border-radius:4px;padding:4px"><div style="font-size:6px;color:#64748B;font-weight:800">CUSTOMER / العميل</div><div style="font-size:8px;color:#1F4E79;font-weight:800;margin-top:3px">Customer Name</div><div style="font-size:6px;color:#64748B">Attention / عناية</div></div><div style="border:1px solid #CBD5E1;border-radius:4px;padding:4px"><div style="font-size:6px;color:#64748B;font-weight:800">QUOTATION INFORMATION / بيانات العرض</div><div style="font-size:6px;margin-top:3px"><b>Quotation No.</b> Q-2606-001</div><div style="font-size:6px"><b>Client Ref</b> RFQ-001</div><div style="font-size:6px"><b>Date</b> 27-Jun</div></div></div><div style="margin-top:5px;background:#1F4E79;color:#fff;font-size:5px;padding:2px 4px"># DESCRIPTION / البيان QTY / الكمية AMOUNT / المبلغ</div></div>`,
  servicequote: `<div style="padding:7px 8px;background:#fff"><div style="font-size:9px;font-weight:900;color:#1F4E79;text-align:center;margin-bottom:5px">CONTRACTING QUOTATION</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px"><div style="border:1px solid #CBD5E1;border-radius:4px;padding:4px"><div style="font-size:6px;color:#64748B;font-weight:800">CUSTOMER</div><div style="font-size:8px;color:#1F4E79;font-weight:800;margin-top:3px">Customer Name</div></div><div style="border:1px solid #CBD5E1;border-radius:4px;padding:4px"><div style="font-size:6px;color:#64748B;font-weight:800">QUOTATION INFORMATION</div><div style="font-size:6px;margin-top:3px"><b>Quotation No.</b> Q-2606-001</div><div style="font-size:6px"><b>Project</b> Site service</div></div></div><div style="margin-top:5px;background:#1F4E79;color:#fff;font-size:5px;padding:2px 4px"># SCOPE OF WORK QTY RATE AMOUNT</div></div>`,
  imageref: `<div style="padding:7px 8px;background:#fff"><div style="font-size:9px;font-weight:900;color:#1F4E79;text-align:center;margin-bottom:5px">QUOTATION WITH IMAGE REF</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px"><div style="border:1px solid #CBD5E1;border-radius:4px;padding:4px"><div style="font-size:6px;color:#64748B;font-weight:800">CUSTOMER</div><div style="font-size:8px;color:#1F4E79;font-weight:800;margin-top:3px">Customer Name</div></div><div style="border:1px solid #CBD5E1;border-radius:4px;padding:4px"><div style="font-size:6px;color:#64748B;font-weight:800">QUOTATION INFORMATION</div><div style="font-size:6px;margin-top:3px"><b>Quotation No.</b> Q-2606-001</div></div></div><div style="margin-top:5px;display:grid;grid-template-columns:18px 32px 1fr 40px;background:#1F4E79;color:#fff;font-size:5px;padding:2px 4px"><span>#</span><span>IMAGE</span><span>DESCRIPTION</span><span>AMOUNT</span></div></div>`,
  imagerefmed: `<div style="padding:7px 8px;background:#fff"><div style="font-size:9px;font-weight:900;color:#1F4E79;text-align:center;margin-bottom:5px">IMAGE REF – MEDIUM</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px"><div style="border:1px solid #CBD5E1;border-radius:4px;padding:4px"><div style="font-size:6px;color:#64748B;font-weight:800">CUSTOMER</div><div style="font-size:8px;color:#1F4E79;font-weight:800;margin-top:3px">Customer Name</div></div><div style="border:1px solid #CBD5E1;border-radius:4px;padding:4px"><div style="font-size:6px;color:#64748B;font-weight:800">QUOTATION INFORMATION</div><div style="font-size:6px;margin-top:3px"><b>Quotation No.</b> Q-2606-001</div></div></div><div style="margin-top:5px;display:grid;grid-template-columns:18px 44px 1fr 34px;background:#1F4E79;color:#fff;font-size:5px;padding:2px 4px"><span>#</span><span>4×3 cm</span><span>DESCRIPTION</span><span>AMOUNT</span></div><div style="margin-top:3px;display:grid;grid-template-columns:18px 44px 1fr 34px;font-size:5px"><span>01</span><span style="height:22px;border:1px solid #CBD5E1;background:#F8FAFC"></span><span>Product description</span><span>SAR</span></div></div>`,
  imagereflarge: `<div style="padding:7px 8px;background:#fff"><div style="font-size:9px;font-weight:900;color:#1F4E79;text-align:center;margin-bottom:5px">IMAGE REF – LARGE</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px"><div style="border:1px solid #CBD5E1;border-radius:4px;padding:4px"><div style="font-size:6px;color:#64748B;font-weight:800">CUSTOMER</div><div style="font-size:8px;color:#1F4E79;font-weight:800;margin-top:3px">Customer Name</div></div><div style="border:1px solid #CBD5E1;border-radius:4px;padding:4px"><div style="font-size:6px;color:#64748B;font-weight:800">QUOTATION INFORMATION</div><div style="font-size:6px;margin-top:3px"><b>Quotation No.</b> Q-2606-001</div></div></div><div style="margin-top:5px;display:grid;grid-template-columns:18px 62px 1fr 32px;background:#1F4E79;color:#fff;font-size:5px;padding:2px 4px"><span>#</span><span>6×5 cm</span><span>DESCRIPTION</span><span>AMOUNT</span></div><div style="margin-top:3px;display:grid;grid-template-columns:18px 62px 1fr 32px;font-size:5px"><span>01</span><span style="height:32px;border:1px solid #CBD5E1;background:#F8FAFC"></span><span>Equipment description</span><span>SAR</span></div></div>`,
  imagerefattach: `<div style="padding:7px 8px;background:#fff"><div style="font-size:9px;font-weight:900;color:#1F4E79;text-align:center;margin-bottom:5px">IMAGE REF – ATTACHMENT</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px"><div style="border:1px solid #CBD5E1;border-radius:4px;padding:4px"><div style="font-size:6px;color:#64748B;font-weight:800">CUSTOMER</div><div style="font-size:8px;color:#1F4E79;font-weight:800;margin-top:3px">Customer Name</div></div><div style="border:1px solid #CBD5E1;border-radius:4px;padding:4px"><div style="font-size:6px;color:#64748B;font-weight:800">QUOTATION INFORMATION</div><div style="font-size:6px;margin-top:3px"><b>Quotation No.</b> Q-2606-001</div></div></div><div style="margin-top:5px;background:#1F4E79;color:#fff;font-size:5px;padding:2px 4px"># DESCRIPTION QTY AMOUNT</div><div style="margin-top:5px;border-top:1px dashed #CBD5E1;padding-top:3px;font-size:6px;color:#1F4E79;font-weight:800">ATTACHMENT – PRODUCT REFERENCE</div><div style="height:20px;border:1px solid #CBD5E1;background:#F8FAFC;margin-top:2px"></div></div>`,
  bilingual: `<div style="background:#0B539D;padding:6px 8px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #F15A25"><div><div style="color:#fff;font-size:7px;font-weight:700">DOWNTOWN TRADING EST.</div><div style="color:#CFE2F4;font-size:8px;direction:rtl">داون تاون للتجارة</div></div><div style="text-align:right"><div style="display:flex;gap:3px;justify-content:flex-end"><span style="background:#F15A25;color:#fff;font-size:7px;padding:1px 3px;font-weight:800">QUOTATION</span><span style="background:#F15A25;color:#fff;font-size:8px;padding:1px 3px;direction:rtl;font-weight:800">عرض سعر</span></div><div style="color:#fff;font-size:8px;font-weight:800">Q-2606-001</div></div></div><div style="background:#FFF9F0;padding:4px 8px;font-size:7px;display:flex;justify-content:space-between;border-bottom:1px solid #ede0cc"><span><b style="color:#0B539D">Customer</b> / <span style="direction:rtl;color:#0B539D">العميل</span></span><span style="direction:rtl;font-size:7px;color:#555">مقدم إلى</span></div><div style="padding:3px 8px"><div style="background:#0B539D;color:#fff;font-size:5px;padding:2px 4px">AMOUNT المبلغ | PRICE السعر | QTY الكمية | DESCRIPTION البيان | #</div></div>`
};

function openTemplatePicker(qid) {
  _printQID = qid;
  const qForTpl = quotations.find(x=>x.id===qid);
  const typeDefault = qForTpl && qForTpl.quoteType === 'contracting' ? 'servicequote' : 'erpbox';
  const preferredTpl = settings.lastTemplate || typeDefault;
  const saved = TEMPLATES.some(t => t.id === preferredTpl) ? preferredTpl : typeDefault;
  document.getElementById('template-cards').innerHTML = TEMPLATES.map(t => `
    <div class="tpl-card ${t.id===saved?'selected':''}" id="tpl-${t.id}" title="${t.desc}" onclick="selectTemplate('${t.id}')">
      <div class="tpl-preview">${TPL_PREVIEWS[t.id]||''}</div>
      <div style="display:flex;align-items:center;gap:6px;justify-content:space-between;margin-bottom:4px">
        <div class="tpl-name">${t.name}</div>
        ${t.badge ? `<span class="tpl-badge">${t.badge}</span>` : ''}
      </div>
      <div class="tpl-desc">${t.desc}</div>
    </div>`).join('');
  openModalWithSize('template-picker-modal');
}

function selectTemplate(id) {
  document.querySelectorAll('.tpl-card').forEach(c=>c.classList.remove('selected'));
  const el = document.getElementById('tpl-'+id);
  if (el) el.classList.add('selected');
}

async function printWithSelectedTemplate() {
  const sel = document.querySelector('.tpl-card.selected');
  const tpl = sel ? sel.id.replace('tpl-','') : 'erpbox';
  settings.lastTemplate = tpl;
  try { localStorage.setItem('dtq_settings', JSON.stringify(settings)); } catch(e){}
  closeModal('template-picker-modal');
  if      (tpl === 'professional') printQuotation(_printQID);
  else if (tpl === 'classic')      printQuotationClassic(_printQID);
  else if (tpl === 'modern')       printQuotationModern(_printQID);
  else if (tpl === 'executive')    printQuotationExecutive(_printQID);
  else if (tpl === 'erpbox')       printQuotationInfoLayout(_printQID,'erpbox');
  else if (tpl === 'premiumcard')  printQuotationInfoLayout(_printQID,'premiumcard');
  else if (tpl === 'executiveinfo')printQuotationInfoLayout(_printQID,'executiveinfo');
  else if (tpl === 'erpbilingual') printQuotationErpVariant(_printQID,'bilingual');
  else if (tpl === 'servicequote') printQuotationErpVariant(_printQID,'contracting');
  else if (tpl === 'imageref')     printQuotationErpVariant(_printQID,'image');
  else if (tpl === 'imagerefmed')  printQuotationErpVariant(_printQID,'image-medium');
  else if (tpl === 'imagereflarge')printQuotationErpVariant(_printQID,'image-large');
  else if (tpl === 'imagerefattach')printQuotationErpVariant(_printQID,'image-attachment');
  else if (tpl === 'bilingual')    printQuotationBilingual(_printQID);
}

/* ── Shared helper: builds common data for all templates ── */
function _tplData(id) {
  const q=quotations.find(x=>x.id===id); if(!q) return null;
  const {sub,disc,bvat,vat,net}=calcQuote(q);
  const vu=validUntil(q);
  const co=settings.coname||'Downtown Trading Est.';
  const addr1=buildAddressLine1(settings);
  const addr2=buildAddressLine2(settings);
  const headerInfo=buildPrintHeaderInfo(settings);
  return {q,sub,disc,bvat,vat,net,vu,co,addr1,addr2,headerInfo,
    f1:buildPrintFooterAddress(settings),
    f2:buildPrintFooterInfo(settings)};
}

function _tplOpen(html) {
  const w=window.open('','_blank','width=880,height=1020');
  w.document.write(html); w.document.close();
}


/* ══════════ TEMPLATE OPTIONS: QUOTATION INFORMATION LAYOUTS ══════════ */
function printQuotationInfoLayout(id, layout) {
  const d=_tplData(id); if(!d) return;
  const {q,sub,disc,bvat,vat,net,vu,co,f1,f2,headerInfo}=d;
  const logoHtml = settings.logo
    ? '<img src="'+settings.logo+'" alt="'+co+'" style="height:48px;width:auto;max-width:210px;object-fit:contain">'
    : '<div style="font-size:17px;font-weight:900;color:#1F4E79">'+co+'</div>';
  const rows=(q.items||[]).map(function(it,i){
    if(it.lineType==='heading') return '<tr><td colspan="99" style="padding:7px 8px;background:#EEF4FB;color:#1F4E79;font-weight:800;border-top:1px solid #CBD5E1;border-bottom:1px solid #CBD5E1">'+escapeHtml(it.text||it.desc||'')+'</td></tr>';
    if(it.lineType==='note') return '<tr><td></td><td colspan="98" style="padding:6px 8px;background:#FFFBEA;color:#475569;font-style:italic;border-top:1px solid #EADFAE;border-bottom:1px solid #EADFAE">Note: '+escapeHtml(it.text||it.desc||'')+'</td></tr>';
    const t=(parseFloat(it.qty)||0)*(parseFloat(it.up)||0);
    const subline=[it.brand,it.model].filter(Boolean).join(' · ');
    return '<tr>'
      +'<td class="num">'+String(i+1).padStart(2,'0')+'</td>'
      +'<td><div>'+(it.desc||'')+'</div>'
      +(subline?'<div class="dsub">'+subline+'</div>':'')
      +(it.specs?'<div class="dsub">'+it.specs+'</div>':'')+'</td>'
      +'<td class="c">'+it.qty+'</td>'
      +'<td class="c">'+(it.uom||'')+'</td>'
      +'<td class="r">'+pdfLineUnitMoney(it.up)+'</td>'
      +'<td class="r">'+pdfLineAmountMoney(t)+'</td></tr>';
  }).join('');
  const infoRows = '<div class="info-row"><span>Quotation No.</span><b>'+q.qno+'</b></div>'
    +(q.ref?'<div class="info-row"><span>Client Ref</span><b>'+q.ref+'</b></div>':'')
    +'<div class="info-row"><span>Date</span><b>'+fmtDate(q.date)+'</b></div>'
    +'<div class="info-row"><span>Valid Until</span><b>'+fmtDate(vu)+'</b></div>';
  const custBlock = '<div class="panel"><div class="panel-title">Customer</div>'
    +'<div class="cust-name">'+q.company+'</div>'
    +(q.contact?'<div class="cust-line"><span>Attention</span> '+q.contact+'</div>':'')
    +(q.project?'<div class="cust-line"><span>Project</span> '+q.project+'</div>':'')
    +(q.city?'<div class="cust-line"><span>Address</span> '+q.city+'</div>':'')
    +'</div>';
  const docPanel = '<div class="panel"><div class="panel-title">Quotation Information</div>'+infoRows+'</div>';
  let infoHtml='';
  let bodyClass='layout-erp';
  if(layout==='premiumcard') {
    bodyClass='layout-premium';
    infoHtml = '<div class="premium-customer">'+custBlock+'</div><div class="premium-title">QUOTATION</div><div class="premium-card">'+infoRows+'</div>';
  } else if(layout==='executiveinfo') {
    bodyClass='layout-executive-info';
    infoHtml = '<div class="modern-title">QUOTATION</div><div class="split-panels executive-split">'+custBlock+docPanel+'</div>';
  } else {
    infoHtml = '<div class="split-panels">'+custBlock+docPanel+'</div>';
  }
  const totRow=function(k,v){return '<div class="tot-row"><span>'+k+'</span><b>'+v+'</b></div>';};
  const html='<!DOCTYPE html><html><head><title>'+q.qno+'</title><meta charset="UTF-8"><style>'
+'*{box-sizing:border-box;margin:0;padding:0}'
+'body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#1E293B;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
+'@media print{@page{size:A4;margin:10mm 12mm 18mm 12mm;@bottom-right{content:"Page " counter(page) " of " counter(pages);font-family:Arial;font-size:8pt;color:#64748B}}.pw{box-shadow:none!important}}'
+'@media screen{body{background:#d0d0d0;padding:20px 0}.pw{box-shadow:0 4px 20px rgba(0,0,0,.2)}}'
+'.pw{width:210mm;margin:0 auto;background:#fff;border-collapse:collapse;table-layout:fixed}.pw td{vertical-align:top}.header{padding:14px 12mm 10px;border-bottom:3px solid #1F4E79}.hrow{display:flex;justify-content:space-between;align-items:center}.brand{display:flex;align-items:center;gap:12px}.logo-card{background:#fff;border:1px solid #E2E8F0;border-radius:6px;padding:6px 11px}.co-meta{font-size:9.5px;color:#475569;line-height:1.55}.doc-chip{background:#1F4E79;color:#fff;font-size:14px;letter-spacing:2px;text-transform:uppercase;font-weight:900;padding:5px 12px;border-radius:3px}.doc-no{font-size:15px;color:#1F4E79;font-weight:900;margin-top:5px;text-align:right}'
+'.info-wrap{padding:11px 12mm 10px}.split-panels{display:grid;grid-template-columns:1fr 1fr;gap:12px}.panel{border:1px solid #CBD5E1;border-radius:8px;background:#fff;min-height:92px;padding:11px 13px}.panel-title{font-size:8.5px;text-transform:uppercase;letter-spacing:1.4px;color:#64748B;font-weight:900;margin-bottom:7px}.cust-name{font-size:14px;color:#1F4E79;font-weight:900;margin-bottom:4px}.cust-line{font-size:10.5px;color:#475569;line-height:1.55}.cust-line span{display:inline-block;width:62px;color:#64748B;font-weight:700}.info-row{display:grid;grid-template-columns:94px 1fr;gap:8px;padding:4px 0;border-bottom:1px solid #EEF2F7;font-size:10.5px}.info-row:last-child{border-bottom:none}.info-row span{color:#64748B;font-weight:700}.info-row b{color:#1E293B;font-weight:800}.premium-title,.modern-title{text-align:center;font-size:16px;letter-spacing:2.5px;color:#1F4E79;font-weight:900;margin:4px 0 9px}.premium-card{width:68%;margin:0 auto;border:1px solid #CBD5E1;border-radius:9px;padding:10px 14px;background:#F8FAFC}.premium-customer .panel{min-height:auto;margin-bottom:7px}.layout-executive-info .modern-title{border-top:2px solid #1F4E79;border-bottom:1px solid #CBD5E1;padding:8px 0;margin:0 0 10px}.executive-split{align-items:stretch}.executive-split .panel{min-height:96px;border-color:#E2E8F0;background:#fff}.executive-split .panel-title{color:#1F4E79}.line-section{border-bottom:1px solid #E2E8F0;padding:8px 0}.line-section .panel{border:none;border-radius:0;padding:0;background:#fff;min-height:auto}.doc-info{max-width:430px;margin:0 auto}.doc-info .info-row{grid-template-columns:120px 1fr}'
+'.items-wrap{padding:0 12mm}.items{width:100%;border-collapse:collapse}.items thead{display:table-header-group}.items tr{page-break-inside:avoid;break-inside:avoid}.items th{background:#1F4E79;color:#fff;padding:7px 8px;font-size:9px;text-align:left;text-transform:uppercase;letter-spacing:.5px}.items th.r,.items td.r{text-align:right}.items th.c,.items td.c{text-align:center}.items td{padding:6px 8px;border-bottom:1px solid #EEF2F7;font-size:10.5px;color:#000!important;font-weight:400!important}.items td *{color:#000!important;font-weight:400!important}.items tbody tr:nth-child(even) td{background:#F8FAFC}.num{text-align:center;color:#64748B!important;width:30px}.dsub{font-size:9px;color:#64748B!important;margin-top:2px}'
+'.after{display:grid;grid-template-columns:1fr 270px;gap:18px;padding:12px 12mm 0;page-break-inside:avoid}.terms{background:#F8FAFC;border-left:3px solid #1F4E79;padding:9px 12px}.terms-title{font-size:8.5px;text-transform:uppercase;letter-spacing:1.2px;color:#1F4E79;font-weight:900;margin-bottom:5px}.terms ul{padding-left:15px;color:#475569;font-size:10px;line-height:1.5}.tot{border:1px solid #CBD5E1;border-radius:8px;overflow:hidden}.tot-row{display:flex;justify-content:space-between;padding:6px 11px;border-bottom:1px solid #E2E8F0;font-size:10.5px}.tot-row span{color:#64748B}.tot-row b{font-variant-numeric:tabular-nums}.tot-net{background:#1F4E79;color:#fff;padding:11px;display:flex;justify-content:space-between;align-items:center}.tot-net span{font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#DCEBFA;font-weight:900}.tot-net b{font-size:17px;color:#fff;font-weight:900}.notes{margin:9px 12mm 0;padding:8px 12px;background:#FFFBEA;border:1px solid #F0D77B;font-size:10px;color:#5A4A0A}.sig{display:grid;grid-template-columns:1fr 1fr;gap:55px;margin:15mm 12mm 10px;page-break-inside:avoid}.sig div{border-top:1.5px solid #1F4E79;padding-top:6px;font-size:9px;color:#64748B;font-weight:700}.closing{margin:8px 12mm 10px;text-align:center;font-size:10px;line-height:1.5;color:#64748B;font-style:italic;page-break-inside:avoid}.closing span{font-size:9.5px;color:#6B7280}.footer{border-top:1px solid #CBD5E1;padding:6px 12mm 4px;font-size:9.5px;color:#64748B;display:flex;justify-content:space-between;line-height:1.5}'
+'</style></head><body><table class="pw '+bodyClass+'"><tfoot><tr><td style="padding:0"><div class="footer"><span>'+f1+'</span><span>'+f2+'</span></div></td></tr></tfoot><tbody><tr><td style="padding:0">'
+'<div class="header"><div class="hrow"><div class="brand"><div class="logo-card">'+logoHtml+'</div><div class="co-meta">'+headerInfo+'</div></div><div><div class="doc-chip">Quotation</div><div class="doc-no">'+q.qno+'</div></div></div></div>'
+'<div class="info-wrap">'+infoHtml+'</div>'
+'<div class="items-wrap"><table class="items"><thead><tr><th style="width:30px">#</th><th>Description</th><th class="c" style="width:46px">Qty</th><th class="c" style="width:48px">UOM</th><th class="r" style="width:88px">Unit Price</th><th class="r" style="width:92px">Amount</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
+'<div class="after"><div class="terms"><div class="terms-title">Terms &amp; Conditions</div><ul><li>This quotation is valid for '+(q.validity||7)+' days from the date of issue.</li><li>Delivery terms: '+(q.delivery||'—')+'</li><li>Payment terms: '+(q.payment||'—')+'</li><li>Stock is subject to availability at the time of order confirmation.</li></ul></div><div class="tot">'
+totRow('Sub-total',pdfSummaryMoney(sub))+(disc>0?totRow('Discount','− '+pdfSummaryMoney(disc))+totRow('Total before VAT',pdfSummaryMoney(bvat)):'')+totRow('VAT ('+getQuoteVatPercent(q)+'%)',pdfSummaryMoney(vat))+'<div class="tot-net"><span>Net Amount</span><b>'+pdfGrandTotalMoney(net)+'</b></div></div></div>'
+(q.notes?'<div class="notes"><strong>Notes:</strong> '+q.notes+'</div>':'')
+'<div class="sig"><div>CUSTOMER ACCEPTANCE &amp; SIGNATURE</div><div>AUTHORISED SIGNATURE — '+co.toUpperCase()+'</div></div>'
+'<div class="closing">Thank you for the opportunity to quote. We look forward to serving you.<br><span>If you have any questions regarding this quotation, please feel free to contact us.</span></div>'
+'</td></tr></tbody></table><scr'+'ipt>window.onload=function(){setTimeout(function(){window.print()},600)}<'+'/script></body></html>';
  _tplOpen(html);
}


/* ══════════ MODERN ERP VARIANTS: BILINGUAL / SERVICE / IMAGE REF ══════════ */
function printQuotationErpVariant(id, variant) {
  const d=_tplData(id); if(!d) return;
  const {q,sub,disc,bvat,vat,net,vu,co,f1,f2,headerInfo}=d;
  const logoHtml = settings.logo
    ? '<img src="'+settings.logo+'" alt="'+co+'" style="height:50px;width:auto;max-width:220px;object-fit:contain">'
    : '<div style="font-size:17px;font-weight:900;color:#1F4E79">'+co+'</div>';
  const isBi = variant === 'bilingual';
  const isContracting = variant === 'contracting';
  const isService = isContracting;
  const isHybrid = variant === 'hybrid';
  const isImage = ['image','image-medium','image-large','image-attachment'].includes(variant);
  const isImageAttachment = variant === 'image-attachment';
  const imageSize = variant === 'image-medium' ? {w:'40mm',h:'30mm',col:'48mm'} : (variant === 'image-large' ? {w:'60mm',h:'50mm',col:'68mm'} : {w:'58px',h:'46px',col:'78px'});
  const title = isBi ? 'QUOTATION <span>عرض سعر</span>' : (isContracting ? 'CONTRACTING QUOTATION' : 'QUOTATION');
  const docTitle = isBi ? 'Quotation / عرض سعر' : 'Quotation';
  const customerTitle = isBi ? 'Customer / العميل' : 'Customer';
  const infoTitle = isBi ? 'Quotation Information / بيانات العرض' : 'Quotation Information';
  const labels = isBi ? {
    qno:'Quotation No. / رقم العرض', ref:'Client Ref / مرجع العميل', date:'Date / التاريخ', valid:'Valid Until / صالح حتى',
    attention:'Attention / عناية', project:'Project / المشروع', address:'Address / العنوان', subtotal:'Sub-total / الإجمالي', discount:'Discount / الخصم', beforeVat:'Total before VAT / الإجمالي قبل الضريبة', vat:'VAT / ضريبة القيمة المضافة', net:'Net Amount / صافي المبلغ'
  } : {
    qno:'Quotation No.', ref:'Client Ref', date:'Date', valid:'Valid Until', attention:'Attention', project:'Project', address:'Address', subtotal:'Sub-total', discount:'Discount', beforeVat:'Total before VAT', vat:'VAT', net:'Net Amount'
  };
  const productImage = function(it){
    if (it.image) return it.image;
    const p = products.find(x =>
      (it.prodId && x.id === it.prodId) ||
      (it.code && x.code === it.code) ||
      (it.desc && x.name === it.desc)
    );
    return (p && p.image) ? p.image : '';
  };
  const normalRows=(q.items||[]).map(function(it,i){
    if(it.lineType==='heading') return '<tr><td colspan="99" style="padding:7px 8px;background:#EEF4FB;color:#1F4E79;font-weight:800;border-top:1px solid #CBD5E1;border-bottom:1px solid #CBD5E1">'+escapeHtml(it.text||it.desc||'')+'</td></tr>';
    if(it.lineType==='note') return '<tr><td></td><td colspan="98" style="padding:6px 8px;background:#FFFBEA;color:#475569;font-style:italic;border-top:1px solid #EADFAE;border-bottom:1px solid #EADFAE">Note: '+escapeHtml(it.text||it.desc||'')+'</td></tr>';
    const t=(parseFloat(it.qty)||0)*(parseFloat(it.up)||0);
    const subline=[it.brand,it.model].filter(Boolean).join(' · ');
    return '<tr>'
      +'<td class="num">'+String(i+1).padStart(2,'0')+'</td>'
      +'<td><div>'+(it.desc||'')+'</div>'
      +(subline?'<div class="dsub">'+subline+'</div>':'')
      +(it.specs?'<div class="dsub">'+it.specs+'</div>':'')+'</td>'
      +'<td class="c">'+(it.qty||'')+'</td>'
      +'<td class="c">'+(it.uom||'')+'</td>'
      +'<td class="r">'+pdfLineUnitMoney(it.up)+'</td>'
      +'<td class="r">'+pdfLineAmountMoney(t)+'</td></tr>';
  }).join('');
  const serviceRows=(q.items||[]).map(function(it,i){
    if(it.lineType==='heading') return '<tr><td colspan="99" style="padding:7px 8px;background:#EEF4FB;color:#1F4E79;font-weight:800;border-top:1px solid #CBD5E1;border-bottom:1px solid #CBD5E1">'+escapeHtml(it.text||it.desc||'')+'</td></tr>';
    if(it.lineType==='note') return '<tr><td></td><td colspan="98" style="padding:6px 8px;background:#FFFBEA;color:#475569;font-style:italic;border-top:1px solid #EADFAE;border-bottom:1px solid #EADFAE">Note: '+escapeHtml(it.text||it.desc||'')+'</td></tr>';
    const t=(parseFloat(it.qty)||0)*(parseFloat(it.up)||0);
    const scope=[it.brand,it.model,it.specs].filter(Boolean).join(' · ');
    return '<tr>'
      +'<td class="num">'+String(i+1).padStart(2,'0')+'</td>'
      +'<td><div>'+(it.desc||'')+'</div>'+(scope?'<div class="dsub">'+scope+'</div>':'')+'</td>'
      +'<td class="c">'+(it.qty||'')+'</td>'
      +'<td class="c">'+(it.uom||'Service')+'</td>'
      +'<td class="r">'+pdfLineUnitMoney(it.up)+'</td>'
      +'<td class="r">'+pdfLineAmountMoney(t)+'</td></tr>';
  }).join('');
  const imageRows=(q.items||[]).map(function(it,i){
    if(it.lineType==='heading') return '<tr><td colspan="99" style="padding:7px 8px;background:#EEF4FB;color:#1F4E79;font-weight:800;border-top:1px solid #CBD5E1;border-bottom:1px solid #CBD5E1">'+escapeHtml(it.text||it.desc||'')+'</td></tr>';
    if(it.lineType==='note') return '<tr><td></td><td colspan="98" style="padding:6px 8px;background:#FFFBEA;color:#475569;font-style:italic;border-top:1px solid #EADFAE;border-bottom:1px solid #EADFAE">Note: '+escapeHtml(it.text||it.desc||'')+'</td></tr>';
    const t=(parseFloat(it.qty)||0)*(parseFloat(it.up)||0);
    const img=productImage(it);
    const subline=[it.brand,it.model,it.specs].filter(Boolean).join(' · ');
    return '<tr>'
      +'<td class="num">'+String(i+1).padStart(2,'0')+'</td>'
      +'<td class="imgcell">'+(img?'<img src="'+img+'">':'<div class="imgph">No image</div>')+'</td>'
      +'<td><div>'+(it.desc||'')+'</div>'+(subline?'<div class="dsub">'+subline+'</div>':'')+'</td>'
      +'<td class="c">'+(it.qty||'')+'</td>'
      +'<td class="c">'+(it.uom||'')+'</td>'
      +'<td class="r">'+pdfLineUnitMoney(it.up)+'</td>'
      +'<td class="r">'+pdfLineAmountMoney(t)+'</td></tr>';
  }).join('');
  const infoRows = '<div class="info-row"><span>'+labels.qno+'</span><b>'+q.qno+'</b></div>'
    +(q.ref?'<div class="info-row"><span>'+labels.ref+'</span><b>'+q.ref+'</b></div>':'')
    +'<div class="info-row"><span>'+labels.date+'</span><b>'+fmtDate(q.date)+'</b></div>'
    +'<div class="info-row"><span>'+labels.valid+'</span><b>'+fmtDate(vu)+'</b></div>';
  const custBlock = '<div class="panel"><div class="panel-title">'+customerTitle+'</div>'
    +'<div class="cust-name">'+q.company+'</div>'
    +(q.contact?'<div class="cust-line"><span>'+labels.attention+'</span> '+q.contact+'</div>':'')
    +(q.project?'<div class="cust-line"><span>'+labels.project+'</span> '+q.project+'</div>':'')
    +(q.city?'<div class="cust-line"><span>'+labels.address+'</span> '+q.city+'</div>':'')
    +'</div>';
  const docPanel = '<div class="panel"><div class="panel-title">'+infoTitle+'</div>'+infoRows+'</div>';
  const totRow=function(k,v){return '<div class="tot-row"><span>'+k+'</span><b>'+v+'</b></div>';};
  const termsTitle = isBi ? 'Terms &amp; Conditions / الشروط والأحكام' : (isContracting ? 'Contracting Terms &amp; Conditions' : (isHybrid ? 'Supply &amp; Installation Terms' : 'Terms &amp; Conditions'));
  const terms = isBi
    ? '<li>هذا العرض صالح لمدة '+(q.validity||7)+' أيام من تاريخ الإصدار.</li><li>This quotation is valid for '+(q.validity||7)+' days from the date of issue.</li><li>Delivery terms: '+(q.delivery||'—')+'</li><li>Payment terms: '+(q.payment||'—')+'</li>'
    : (isContracting
      ? '<li>This contracting quotation is valid for '+(q.validity||7)+' days from the date of issue.</li><li>Scope of work is limited to the listed work descriptions only.</li><li>Delivery / completion terms: '+(q.delivery||'—')+'</li><li>Payment terms: '+(q.payment||'—')+'</li>'
      : (isHybrid
        ? '<li>This supply &amp; installation quotation is valid for '+(q.validity||7)+' days from the date of issue.</li><li>Material supply and site work are limited to the listed descriptions only.</li><li>Delivery / completion terms: '+(q.delivery||'—')+'</li><li>Payment terms: '+(q.payment||'—')+'</li>'
        : '<li>This quotation is valid for '+(q.validity||7)+' days from the date of issue.</li><li>Delivery terms: '+(q.delivery||'—')+'</li><li>Payment terms: '+(q.payment||'—')+'</li><li>Stock is subject to availability at the time of order confirmation.</li>'));
  const headNormal = isBi
    ? '<th style="width:30px">#</th><th>Description / البيان</th><th class="c" style="width:46px">Qty<br>الكمية</th><th class="c" style="width:48px">UOM<br>الوحدة</th><th class="r" style="width:88px">Unit Price<br>السعر</th><th class="r" style="width:92px">Amount<br>المبلغ</th>'
    : (isContracting
      ? '<th style="width:30px">#</th><th>Scope of Work / Description</th><th class="c" style="width:46px">Qty</th><th class="c" style="width:58px">Unit</th><th class="r" style="width:88px">Rate</th><th class="r" style="width:92px">Amount</th>'
      : '<th style="width:30px">#</th><th>Description</th><th class="c" style="width:46px">Qty</th><th class="c" style="width:48px">UOM</th><th class="r" style="width:88px">Unit Price</th><th class="r" style="width:92px">Amount</th>');
  const headImage = '<th style="width:30px">#</th><th class="c" style="width:'+imageSize.col+'">Image Ref</th><th>Description</th><th class="c" style="width:42px">Qty</th><th class="c" style="width:44px">UOM</th><th class="r" style="width:78px">Unit Price</th><th class="r" style="width:84px">Amount</th>';
  const tableHead = (isImage && !isImageAttachment) ? headImage : headNormal;
  const tableRows = (isImage && !isImageAttachment) ? imageRows : (isContracting ? serviceRows : normalRows);
  const attachmentRows = (q.items||[]).map(function(it,i){
    if(it.lineType==='heading') return '<tr><td colspan="99" style="padding:7px 8px;background:#EEF4FB;color:#1F4E79;font-weight:800;border-top:1px solid #CBD5E1;border-bottom:1px solid #CBD5E1">'+escapeHtml(it.text||it.desc||'')+'</td></tr>';
    if(it.lineType==='note') return '<tr><td></td><td colspan="98" style="padding:6px 8px;background:#FFFBEA;color:#475569;font-style:italic;border-top:1px solid #EADFAE;border-bottom:1px solid #EADFAE">Note: '+escapeHtml(it.text||it.desc||'')+'</td></tr>';
    const img=productImage(it);
    const subline=[it.brand,it.model,it.specs].filter(Boolean).join(' · ');
    return '<div class="ref-item"><div class="ref-no">Item '+String(i+1).padStart(2,'0')+'</div>'
      +'<div class="ref-body"><div class="ref-img">'+(img?'<img src="'+img+'">':'<div class="ref-ph">No image</div>')+'</div>'
      +'<div class="ref-text"><div class="ref-title">'+(it.desc||'')+'</div>'+(subline?'<div class="ref-desc">'+subline+'</div>':'')+'</div></div></div>';
  }).join('');
  const attachmentHtml = isImageAttachment ? '<div class="ref-section"><div class="ref-heading">Attachment – Product Reference</div>'+attachmentRows+'</div>' : '';
  const html='<!DOCTYPE html><html><head><title>'+q.qno+'</title><meta charset="UTF-8"><style>'
+'*{box-sizing:border-box;margin:0;padding:0}'
+'body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#1E293B;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
+'@media print{@page{size:A4;margin:10mm 12mm 18mm 12mm;@bottom-right{content:"Page " counter(page) " of " counter(pages);font-family:Arial;font-size:8pt;color:#64748B}}.pw{box-shadow:none!important}}'
+'@media screen{body{background:#d0d0d0;padding:20px 0}.pw{box-shadow:0 4px 20px rgba(0,0,0,.2)}}'
+'.pw{width:210mm;margin:0 auto;background:#fff;border-collapse:collapse;table-layout:fixed}.pw td{vertical-align:top}.header{padding:14px 12mm 10px;border-bottom:3px solid #1F4E79}.hrow{display:flex;justify-content:space-between;align-items:center}.brand{display:flex;align-items:center;gap:12px}.logo-card{background:#fff;border:1px solid #E2E8F0;border-radius:6px;padding:6px 11px}.co-meta{font-size:9.5px;color:#475569;line-height:1.55}.doc-chip{background:#1F4E79;color:#fff;font-size:14px;letter-spacing:2px;text-transform:uppercase;font-weight:900;padding:5px 12px;border-radius:3px}.doc-chip span{font-family:Tahoma,Arial,sans-serif;font-size:15px;margin-left:8px}.doc-no{font-size:15px;color:#1F4E79;font-weight:900;margin-top:5px;text-align:right}'
+'.info-wrap{padding:11px 12mm 10px}.variant-title{text-align:center;font-size:16px;letter-spacing:2px;color:#1F4E79;font-weight:900;margin-bottom:10px}.variant-title span{font-family:Tahoma,Arial,sans-serif;font-size:18px;margin-left:10px}.split-panels{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:stretch}.panel{border:1px solid #CBD5E1;border-radius:8px;background:#fff;min-height:92px;padding:11px 13px}.panel-title{font-size:8.5px;text-transform:uppercase;letter-spacing:1.2px;color:#64748B;font-weight:900;margin-bottom:7px}.cust-name{font-size:14px;color:#1F4E79;font-weight:900;margin-bottom:4px}.cust-line{font-size:10.5px;color:#475569;line-height:1.55}.cust-line span{display:inline-block;width:94px;color:#64748B;font-weight:700}.info-row{display:grid;grid-template-columns:130px 1fr;gap:8px;padding:4px 0;border-bottom:1px solid #EEF2F7;font-size:10.5px}.info-row:last-child{border-bottom:none}.info-row span{color:#64748B;font-weight:700}.info-row b{color:#1E293B;font-weight:800}'
+'.items-wrap{padding:0 12mm}.items{width:100%;border-collapse:collapse}.items thead{display:table-header-group}.items tr{page-break-inside:avoid;break-inside:avoid}.items th{background:#1F4E79;color:#fff;padding:7px 8px;font-size:9px;text-align:left;text-transform:uppercase;letter-spacing:.4px}.items th.r,.items td.r{text-align:right}.items th.c,.items td.c{text-align:center}.items td{padding:6px 8px;border-bottom:1px solid #EEF2F7;font-size:10.5px;color:#000!important;font-weight:400!important}.items td *{color:#000!important;font-weight:400!important}.items tbody tr:nth-child(even) td{background:#F8FAFC}.num{text-align:center;color:#64748B!important;width:30px}.dsub{font-size:9px;color:#64748B!important;margin-top:2px}.imgcell{text-align:center}.imgcell img{width:'+imageSize.w+';height:'+imageSize.h+';object-fit:contain;border:1px solid #CBD5E1;border-radius:4px;background:#fff;padding:2px}.imgph{width:'+imageSize.w+';height:'+imageSize.h+';border:1px dashed #CBD5E1;border-radius:4px;font-size:8px;color:#94A3B8!important;display:flex;align-items:center;justify-content:center;margin:0 auto}.ref-section{margin:10px 12mm 0;page-break-before:auto;page-break-inside:auto}.ref-heading{background:#1F4E79;color:#fff;padding:7px 10px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.8px;border-radius:4px 4px 0 0}.ref-item{border:1px solid #CBD5E1;border-top:none;padding:9px 10px;page-break-inside:avoid}.ref-no{font-size:9px;color:#64748B;font-weight:900;margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px}.ref-body{display:grid;grid-template-columns:68mm 1fr;gap:12px;align-items:start}.ref-img img{width:60mm;height:50mm;object-fit:contain;border:1px solid #CBD5E1;border-radius:5px;background:#fff;padding:3px}.ref-ph{width:60mm;height:50mm;border:1px dashed #CBD5E1;border-radius:5px;display:flex;align-items:center;justify-content:center;color:#94A3B8!important;font-size:10px}.ref-title{font-size:12px;font-weight:800;color:#1F4E79!important;margin-bottom:4px}.ref-desc{font-size:10px;color:#475569!important;line-height:1.5}'
+'.after{display:grid;grid-template-columns:1fr 270px;gap:18px;padding:12px 12mm 0;page-break-inside:avoid}.terms{background:#F8FAFC;border-left:3px solid #1F4E79;padding:9px 12px}.terms-title{font-size:8.5px;text-transform:uppercase;letter-spacing:1.2px;color:#1F4E79;font-weight:900;margin-bottom:5px}.terms ul{padding-left:15px;color:#475569;font-size:10px;line-height:1.5}.tot{border:1px solid #CBD5E1;border-radius:8px;overflow:hidden}.tot-row{display:flex;justify-content:space-between;padding:6px 11px;border-bottom:1px solid #E2E8F0;font-size:10.5px}.tot-row span{color:#64748B}.tot-row b{font-variant-numeric:tabular-nums}.tot-net{background:#1F4E79;color:#fff;padding:11px;display:flex;justify-content:space-between;align-items:center}.tot-net span{font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#DCEBFA;font-weight:900}.tot-net b{font-size:17px;color:#fff;font-weight:900}.notes{margin:9px 12mm 0;padding:8px 12px;background:#FFFBEA;border:1px solid #F0D77B;font-size:10px;color:#5A4A0A}.sig{display:grid;grid-template-columns:1fr 1fr;gap:55px;margin:15mm 12mm 10px;page-break-inside:avoid}.sig div{border-top:1.5px solid #1F4E79;padding-top:6px;font-size:9px;color:#64748B;font-weight:700}.closing{margin:8px 12mm 10px;text-align:center;font-size:10px;line-height:1.5;color:#64748B;font-style:italic;page-break-inside:avoid}.closing span{font-size:9.5px;color:#6B7280}.footer{border-top:1px solid #CBD5E1;padding:6px 12mm 4px;font-size:9.5px;color:#64748B;display:flex;justify-content:space-between;line-height:1.5}'
+'</style></head><body><table class="pw"><tfoot><tr><td style="padding:0"><div class="footer"><span>'+f1+'</span><span>'+f2+'</span></div></td></tr></tfoot><tbody><tr><td style="padding:0">'
+'<div class="header"><div class="hrow"><div class="brand"><div class="logo-card">'+logoHtml+'</div><div class="co-meta">'+headerInfo+'</div></div><div><div class="doc-chip">'+docTitle+'</div><div class="doc-no">'+q.qno+'</div></div></div></div>'
+'<div class="info-wrap"><div class="variant-title">'+title+'</div><div class="split-panels">'+custBlock+docPanel+'</div></div>'
+'<div class="items-wrap"><table class="items"><thead><tr>'+tableHead+'</tr></thead><tbody>'+tableRows+'</tbody></table></div>'
+'<div class="after"><div class="terms"><div class="terms-title">'+termsTitle+'</div><ul>'+terms+'</ul></div><div class="tot">'
+totRow(labels.subtotal,pdfSummaryMoney(sub))+(disc>0?totRow(labels.discount,'− '+pdfSummaryMoney(disc))+totRow(labels.beforeVat,pdfSummaryMoney(bvat)):'')+totRow(labels.vat+' ('+getQuoteVatPercent(q)+'%)',pdfSummaryMoney(vat))+'<div class="tot-net"><span>'+labels.net+'</span><b>'+pdfGrandTotalMoney(net)+'</b></div></div></div>'
+(q.notes?'<div class="notes"><strong>Notes:</strong> '+q.notes+'</div>':'')
+attachmentHtml
+'<div class="sig"><div>CUSTOMER ACCEPTANCE &amp; SIGNATURE</div><div>AUTHORISED SIGNATURE — '+co.toUpperCase()+'</div></div>'
+'<div class="closing">Thank you for the opportunity to quote. We look forward to serving you.<br><span>If you have any questions regarding this quotation, please feel free to contact us.</span></div>'
+'</td></tr></tbody></table><scr'+'ipt>window.onload=function(){setTimeout(function(){window.print()},600)}<'+'/script></body></html>';
  _tplOpen(html);
}

/* ══════════ TEMPLATE 2: CLASSIC ══════════ */
function printQuotationClassic(id) {
  const d=_tplData(id); if(!d) return;
  const {q,sub,disc,bvat,vat,net,vu,co,f1,f2,headerInfo}=d;
  const rows=(q.items||[]).map(function(it,i){
    if(it.lineType==='heading') return '<tr><td colspan="99" style="padding:7px 8px;background:#EEF4FB;color:#1F4E79;font-weight:800;border-top:1px solid #CBD5E1;border-bottom:1px solid #CBD5E1">'+escapeHtml(it.text||it.desc||'')+'</td></tr>';
    if(it.lineType==='note') return '<tr><td></td><td colspan="98" style="padding:6px 8px;background:#FFFBEA;color:#475569;font-style:italic;border-top:1px solid #EADFAE;border-bottom:1px solid #EADFAE">Note: '+escapeHtml(it.text||it.desc||'')+'</td></tr>';
    const t=(parseFloat(it.qty)||0)*(parseFloat(it.up)||0);
    return '<tr style="border-bottom:1px solid #e0e0e0;'+(i%2===0?'background:#fafafa':'')+'">'
      +'<td style="padding:6px 8px;font-size:10.5px;text-align:center;color:#888">'+String(i+1).padStart(2,'0')+'</td>'
      +'<td style="padding:6px 8px;font-size:10.5px">'+(it.desc||'')+(it.brand?'<br><span style="font-size:9px;color:#666">'+it.brand+'</span>':'')+'</td>'
      +'<td style="padding:6px 8px;text-align:center;font-size:10.5px">'+it.qty+'</td>'
      +'<td style="padding:6px 8px;text-align:center;font-size:10px;color:#555">'+(it.uom||'')+'</td>'
      +'<td style="padding:6px 8px;text-align:right;font-size:10.5px">'+Number(it.up).toLocaleString('en',{minimumFractionDigits:2})+'</td>'
      +'<td style="padding:6px 8px;text-align:right;font-size:10.5px">'+t.toLocaleString('en',{minimumFractionDigits:2})+'</td></tr>';
  }).join('');
  const html='<!DOCTYPE html><html><head><title>'+q.qno+'</title><meta charset="UTF-8"><style>'
+'*{box-sizing:border-box;margin:0;padding:0}'
+'body{font-family:Georgia,\'Times New Roman\',serif;font-size:11px;color:#1a1a1a;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
+'@media print{@page{size:A4;margin:10mm 15mm 18mm 15mm;@bottom-right{content:"Page " counter(page) " of " counter(pages);font-family:Arial;font-size:8pt;color:#555}}'
+'tfoot td{padding:0 !important}.pw{box-shadow:none !important}}'
+'@media screen{body{background:#d0d0d0;padding:20px 0}.pw{box-shadow:0 4px 20px rgba(0,0,0,.2)}}'
+'.pw{width:210mm;margin:0 auto;background:#fff;border-collapse:collapse;table-layout:fixed}'
+'.pw>tfoot>tr>td,.pw>tbody>tr>td{padding:0;vertical-align:top}'
+'.quote-items thead{display:table-header-group}.quote-items tr{page-break-inside:avoid;break-inside:avoid}.quote-items tbody td,.quote-items tbody td *{color:#000!important;font-weight:400!important}'
+'</style></head><body><table class="pw">'
+'<tfoot><tr><td><div style="border-top:2px solid #1a1a1a;padding:6px 15mm 4px;font-size:8px;color:#555;font-family:Arial">'
+f1+' \u00b7 '+f2+'</div></td></tr></tfoot>'
+'<tbody><tr><td>'
+'<div style="background:#1a1a1a;padding:16px 15mm;display:flex;justify-content:space-between;align-items:center">'
+'<div>'+(settings.logo?'<img src="'+settings.logo+'" style="height:44px;width:auto;object-fit:contain;background:#fff;padding:3px 10px;border-radius:3px">':'<span style="color:#fff;font-size:16px;font-weight:700">'+co+'</span>')
+'<div style="color:#aaa;font-size:9px;margin-top:5px;font-family:Arial">'+headerInfo+'</div></div>'
+'<div style="text-align:right"><div style="color:#ccc;font-size:14px;letter-spacing:3.5px;font-family:Arial;font-weight:700">QUOTATION</div>'
+'<div style="color:#fff;font-size:18px;font-weight:700;font-family:Arial">'+q.qno+'</div>'
+(q.ref?'<div style="color:#c9a227;font-size:9px;font-family:Arial;font-weight:700">Client Ref: '+q.ref+'</div>':'')
+'<div style="color:#aaa;font-size:9px;font-family:Arial">Issued: '+fmtDate(q.date)+' &nbsp;|&nbsp; Valid: '+fmtDate(vu)+'</div></div></div>'
+'<div style="height:4px;background:#c9a227"></div>'
+'<div style="display:grid;grid-template-columns:1fr 1fr;padding:12px 15mm;gap:20px;border-bottom:1px solid #ddd">'
+'<div><div style="font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:5px;font-family:Arial">Customer</div>'
+'<div style="font-size:14px;font-weight:700">'+q.company+'</div>'
+(q.contact?'<div style="font-size:10px;color:#555">Attention: '+q.contact+'</div>':'')
+(q.project?'<div style="font-size:10px;color:#555">Project: '+q.project+'</div>':'')
+(q.city?'<div style="font-size:10px;color:#555">'+q.city+'</div>':'')+'</div>'
+'<div><div style="font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:5px;font-family:Arial">Details</div>'
+'<table style="font-size:10px;width:100%">'
+'<tr><td style="color:#888;padding:1px 0;width:80px">Validity:</td><td style="font-weight:600">'+(q.validity||7)+' days</td></tr>'
+'<tr><td style="color:#888;padding:1px 0">Delivery:</td><td style="font-weight:600">'+(q.delivery||'\u2014')+'</td></tr>'
+'<tr><td style="color:#888;padding:1px 0">Payment:</td><td style="font-weight:600">'+(q.payment||'\u2014')+'</td></tr>'
+'</table></div></div>'
+'<div style="padding:0 15mm;margin-top:8px"><table class="quote-items" style="width:100%;border-collapse:collapse;font-family:Arial">'
+'<thead><tr style="border-top:2px solid #1a1a1a;border-bottom:2px solid #1a1a1a">'
+'<th style="padding:7px 8px;text-align:center;font-size:9px;width:30px">#</th>'
+'<th style="padding:7px 8px;text-align:left;font-size:9px;letter-spacing:1px">DESCRIPTION</th>'
+'<th style="padding:7px 8px;text-align:center;font-size:9px;width:44px">QTY</th>'
+'<th style="padding:7px 8px;text-align:center;font-size:9px;width:46px">UOM</th>'
+'<th style="padding:7px 8px;text-align:right;font-size:9px;width:84px">UNIT PRICE</th>'
+'<th style="padding:7px 8px;text-align:right;font-size:9px;width:88px">AMOUNT</th>'
+'</tr></thead><tbody>'+rows+'</tbody></table></div>'
+'<div style="display:flex;justify-content:flex-end;padding:10px 15mm;font-family:Arial">'
+'<table style="width:240px;font-size:11px">'
+'<tr style="border-bottom:1px solid #ddd"><td style="padding:4px 0;color:#555">Sub-total</td><td style="text-align:right">'+fmt(sub)+'</td></tr>'
+(disc>0?'<tr style="border-bottom:1px solid #ddd"><td style="padding:4px 0;color:#555">Discount</td><td style="text-align:right">\u2212 '+fmt(disc)+'</td></tr><tr style="border-bottom:1px solid #ddd"><td style="padding:4px 0;color:#555">Total before VAT</td><td style="text-align:right">'+fmt(bvat)+'</td></tr>':'')
+'<tr style="border-bottom:1px solid #ddd"><td style="padding:4px 0;color:#555">VAT ('+(settings.vatrate||15)+'%)</td><td style="text-align:right">'+fmt(vat)+'</td></tr>'
+'<tr style="border-top:2px solid #1a1a1a"><td style="padding:6px 0;font-weight:700;font-size:12px">Net Amount</td><td style="text-align:right;font-weight:700;font-size:12px">'+fmt(net)+'</td></tr>'
+'</table></div>'
+'<div style="margin:8px 15mm 0;padding:10px 12px;background:#f9f9f9;border-left:3px solid #c9a227;font-family:Arial;page-break-inside:avoid">'
+'<div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:5px">Terms &amp; Conditions</div>'
+'<ul style="padding-left:14px;color:#555;font-size:10px">'
+'<li style="margin-bottom:2px">This quotation is valid for '+(q.validity||7)+' days from the date of issue.</li>'
+'<li style="margin-bottom:2px">Delivery: '+(q.delivery||'\u2014')+'</li>'
+'<li style="margin-bottom:2px">Payment: '+(q.payment||'\u2014')+'</li>'
+'<li>Stock subject to availability at the time of order confirmation.</li></ul></div>'
+(q.notes?'<div style="margin:8px 15mm 0;padding:8px 12px;background:#fffbea;border:1px solid #e0c060;font-size:10px;font-family:Arial"><strong>Notes:</strong> '+q.notes+'</div>':'')
+'<div style="display:grid;grid-template-columns:1fr 1fr;gap:50px;margin:15mm 15mm 8px;font-family:Arial;page-break-inside:avoid">'
+'<div style="border-top:1px solid #1a1a1a;padding-top:5px;font-size:9px;color:#888">CUSTOMER ACCEPTANCE &amp; SIGNATURE</div>'
+'<div style="border-top:1px solid #1a1a1a;padding-top:5px;font-size:9px;color:#888">AUTHORISED SIGNATURE \u2014 '+co.toUpperCase()+'</div></div>'
+'<div style="margin:8px 15mm 10px;text-align:center;font-size:10px;line-height:1.5;color:#666;font-style:italic;font-family:Arial;page-break-inside:avoid">Thank you for the opportunity to quote. We look forward to serving you.<br><span style="font-size:9.5px;color:#777">If you have any questions regarding this quotation, please feel free to contact us.</span></div>'
+'</td></tr></tbody></table>'
+'<scr'+'ipt>window.onload=function(){setTimeout(function(){window.print()},600)}<'+'/script>'
+'</body></html>';
  _tplOpen(html);
}

/* ══════════ TEMPLATE 3: MODERN BOLD ══════════ */
function printQuotationModern(id) {
  const d=_tplData(id); if(!d) return;
  const {q,sub,disc,bvat,vat,net,vu,co,f1,f2,headerInfo}=d;
  const rows=(q.items||[]).map(function(it,i){
    if(it.lineType==='heading') return '<tr><td colspan="99" style="padding:7px 8px;background:#EEF4FB;color:#1F4E79;font-weight:800;border-top:1px solid #CBD5E1;border-bottom:1px solid #CBD5E1">'+escapeHtml(it.text||it.desc||'')+'</td></tr>';
    if(it.lineType==='note') return '<tr><td></td><td colspan="98" style="padding:6px 8px;background:#FFFBEA;color:#475569;font-style:italic;border-top:1px solid #EADFAE;border-bottom:1px solid #EADFAE">Note: '+escapeHtml(it.text||it.desc||'')+'</td></tr>';
    const t=(parseFloat(it.qty)||0)*(parseFloat(it.up)||0);
    return '<tr style="'+(i%2===0?'background:#F0F7FF':'background:#fff')+'">'
      +'<td style="padding:7px 10px;font-size:10px;color:#888;border-bottom:1px solid #e8f0fb;text-align:center">'+String(i+1).padStart(2,'0')+'</td>'
      +'<td style="padding:7px 10px;font-size:10.5px;border-bottom:1px solid #e8f0fb">'+(it.desc||'')+(it.brand?'<br><span style="font-size:9px;color:#888">'+it.brand+'</span>':'')+'</td>'
      +'<td style="padding:7px 10px;text-align:center;font-size:10.5px;border-bottom:1px solid #e8f0fb">'+it.qty+'</td>'
      +'<td style="padding:7px 10px;text-align:center;font-size:10px;color:#666;border-bottom:1px solid #e8f0fb">'+(it.uom||'')+'</td>'
      +'<td style="padding:7px 10px;text-align:right;font-size:10.5px;border-bottom:1px solid #e8f0fb">'+Number(it.up).toLocaleString('en',{minimumFractionDigits:2})+'</td>'
      +'<td style="padding:7px 10px;text-align:right;font-size:10.5px;font-weight:600;border-bottom:1px solid #e8f0fb">'+t.toLocaleString('en',{minimumFractionDigits:2})+'</td></tr>';
  }).join('');
  const infoCell=function(k,v){return '<div><div style="font-size:8px;text-transform:uppercase;letter-spacing:.8px;color:#0B539D;font-weight:700">'+k+'</div><div style="font-size:10px;font-weight:600">'+v+'</div></div>';};
  const html='<!DOCTYPE html><html><head><title>'+q.qno+'</title><meta charset="UTF-8"><style>'
+'*{box-sizing:border-box;margin:0;padding:0}'
+'body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#1a1a1a;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
+'@media print{@page{size:A4;margin:10mm 0 18mm 0;@bottom-right{content:"Page " counter(page) " of " counter(pages);font-family:Arial;font-size:8pt;color:#555;margin-right:12mm}}'
+'tfoot td{padding:0 !important}.pw{box-shadow:none !important}}'
+'@media screen{body{background:#d0d0d0;padding:20px 0}.pw{box-shadow:0 4px 20px rgba(0,0,0,.2)}}'
+'.pw{width:210mm;margin:0 auto;background:#fff;border-collapse:collapse;table-layout:fixed}'
+'.pw>tfoot>tr>td,.pw>tbody>tr>td{padding:0;vertical-align:top}'
+'.quote-items thead{display:table-header-group}.quote-items tr{page-break-inside:avoid;break-inside:avoid}.quote-items tbody td,.quote-items tbody td *{color:#000!important;font-weight:400!important}'
+'</style></head><body><table class="pw">'
+'<tfoot><tr><td><div style="border-top:3px solid #0B539D;padding:5px 12mm 4px;font-size:8px;color:#555;display:flex;justify-content:space-between;background:#fff">'
+'<span>'+f1+'</span><span>'+f2+'</span></div></td></tr></tfoot>'
+'<tbody><tr><td>'
+'<div style="background:linear-gradient(120deg,#0B539D 0%,#0a3d72 100%);padding:20px 12mm;display:flex;justify-content:space-between;align-items:center">'
+'<div>'+(settings.logo?'<div style="background:#fff;border-radius:6px;padding:6px 12px;display:inline-flex;margin-bottom:8px"><img src="'+settings.logo+'" style="height:44px;width:auto;object-fit:contain"></div><br>':'')
+'<div style="color:rgba(255,255,255,.75);font-size:9px">'+headerInfo+'</div>'
+'</div>'
+'<div style="text-align:right"><div style="color:rgba(255,255,255,.6);font-size:10.5px;letter-spacing:3px;margin-bottom:6px">Q U O T A T I O N</div>'
+'<div style="color:#fff;font-size:26px;font-weight:900;letter-spacing:-1px">'+q.qno+'</div>'
+(q.ref?'<div style="color:#FFD08A;font-size:9px;margin-top:2px;font-weight:700">Client Ref: '+q.ref+'</div>':'')
+'<div style="color:rgba(255,255,255,.75);font-size:9px;margin-top:4px">Issued: '+fmtDate(q.date)+'</div>'
+'<div style="color:rgba(255,255,255,.75);font-size:9px">Valid until: '+fmtDate(vu)+'</div></div></div>'
+'<div style="height:5px;background:linear-gradient(90deg,#F15A25,#ff8c00)"></div>'
+'<div style="background:#F0F7FF;padding:10px 12mm;display:grid;grid-template-columns:1.5fr 1fr;gap:16px;border-bottom:1px solid #D0E4F7">'
+'<div><div style="font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:#0B539D;font-weight:700;margin-bottom:4px">Customer</div>'
+'<div style="font-size:13px;font-weight:800;color:#0B539D">'+q.company+'</div>'
+(q.contact?'<div style="font-size:10px;color:#555;margin-top:2px">Attention: '+q.contact+'</div>':'')
+(q.project?'<div style="font-size:10px;color:#555;margin-top:2px">Project: '+q.project+'</div>':'')+'</div>'
+'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">'
+infoCell('Validity',(q.validity||7)+' days')+infoCell('Currency','SAR')
+infoCell('Delivery',q.delivery||'\u2014')+infoCell('Payment',q.payment||'\u2014')
+'</div></div>'
+'<div style="padding:0 12mm"><table class="quote-items" style="width:100%;border-collapse:collapse">'
+'<thead><tr style="background:#0B539D">'
+'<th style="padding:8px 10px;color:#fff;font-size:9px;text-align:center;width:30px">#</th>'
+'<th style="padding:8px 10px;color:#fff;font-size:9px;text-align:left;letter-spacing:.5px">DESCRIPTION</th>'
+'<th style="padding:8px 10px;color:#fff;font-size:9px;text-align:center;width:44px">QTY</th>'
+'<th style="padding:8px 10px;color:#fff;font-size:9px;text-align:center;width:46px">UOM</th>'
+'<th style="padding:8px 10px;color:#fff;font-size:9px;text-align:right;width:84px">UNIT PRICE</th>'
+'<th style="padding:8px 10px;color:#fff;font-size:9px;text-align:right;width:88px">AMOUNT</th>'
+'</tr></thead><tbody>'+rows+'</tbody></table></div>'
+'<div style="display:flex;justify-content:flex-end;padding:12px 12mm;page-break-inside:avoid"><div style="width:260px">'
+'<div style="display:flex;justify-content:space-between;padding:5px 12px;font-size:11px;border-bottom:1px solid #e0e0e0"><span style="color:#666">Sub-total</span><span>'+fmt(sub)+'</span></div>'
+(disc>0?'<div style="display:flex;justify-content:space-between;padding:5px 12px;font-size:11px;border-bottom:1px solid #e0e0e0"><span style="color:#666">Discount</span><span>\u2212 '+fmt(disc)+'</span></div><div style="display:flex;justify-content:space-between;padding:5px 12px;font-size:11px;border-bottom:1px solid #e0e0e0"><span style="color:#666">Total before VAT</span><span>'+fmt(bvat)+'</span></div>':'')
+'<div style="display:flex;justify-content:space-between;padding:5px 12px;font-size:11px"><span style="color:#666">VAT ('+(settings.vatrate||15)+'%)</span><span>'+fmt(vat)+'</span></div>'
+'<div style="background:linear-gradient(90deg,#0B539D,#0a3d72);color:#fff;padding:12px;display:flex;justify-content:space-between;align-items:center;margin-top:4px">'
+'<span style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,.7)">Net Amount</span>'
+'<span style="font-size:18px;font-weight:900">'+fmt(net)+'</span></div></div></div>'
+'<div style="margin:0 12mm;padding:10px 12px;background:#FFF8F0;border-left:4px solid #F15A25;page-break-inside:avoid">'
+'<div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;font-weight:700;color:#F15A25;margin-bottom:5px">Terms &amp; Conditions</div>'
+'<ul style="padding-left:14px;color:#555;font-size:10px">'
+'<li style="margin-bottom:2px">This quotation is valid for '+(q.validity||7)+' days from date of issue.</li>'
+'<li style="margin-bottom:2px">Delivery: '+(q.delivery||'\u2014')+'</li>'
+'<li style="margin-bottom:2px">Payment: '+(q.payment||'\u2014')+'</li>'
+'<li>Stock subject to availability at time of order confirmation.</li></ul></div>'
+(q.notes?'<div style="margin:8px 12mm 0;padding:8px 12px;background:#fffbea;border:1px solid #F0D77B;font-size:10px"><strong>Notes:</strong> '+q.notes+'</div>':'')
+'<div style="display:grid;grid-template-columns:1fr 1fr;gap:50px;margin:15mm 12mm 8px;page-break-inside:avoid">'
+'<div style="border-top:2px solid #0B539D;padding-top:6px;font-size:9px;color:#888">CUSTOMER ACCEPTANCE &amp; SIGNATURE</div>'
+'<div style="border-top:2px solid #0B539D;padding-top:6px;font-size:9px;color:#888">AUTHORISED SIGNATURE \u2014 '+co.toUpperCase()+'</div></div>'
+'<div style="margin:8px 12mm 10px;text-align:center;font-size:10px;line-height:1.5;color:#64748B;font-style:italic;page-break-inside:avoid">Thank you for the opportunity to quote. We look forward to serving you.<br><span style="font-size:9.5px;color:#6B7280">If you have any questions regarding this quotation, please feel free to contact us.</span></div>'
+'</td></tr></tbody></table>'
+'<scr'+'ipt>window.onload=function(){setTimeout(function(){window.print()},600)}<'+'/script>'
+'</body></html>';
  _tplOpen(html);
}


/* ══════════ TEMPLATE 4: EXECUTIVE CLEAN ══════════ */
function printQuotationExecutive(id) {
  const d=_tplData(id); if(!d) return;
  const {q,sub,disc,bvat,vat,net,vu,co,f1,f2,headerInfo}=d;
  const rows=(q.items||[]).map(function(it,i){
    if(it.lineType==='heading') return '<tr><td colspan="99" style="padding:7px 8px;background:#EEF4FB;color:#1F4E79;font-weight:800;border-top:1px solid #CBD5E1;border-bottom:1px solid #CBD5E1">'+escapeHtml(it.text||it.desc||'')+'</td></tr>';
    if(it.lineType==='note') return '<tr><td></td><td colspan="98" style="padding:6px 8px;background:#FFFBEA;color:#475569;font-style:italic;border-top:1px solid #EADFAE;border-bottom:1px solid #EADFAE">Note: '+escapeHtml(it.text||it.desc||'')+'</td></tr>';
    const t=(parseFloat(it.qty)||0)*(parseFloat(it.up)||0);
    const subline=[it.brand,it.model].filter(Boolean).join(' \u00b7 ');
    return '<tr>'
      +'<td style="padding:9px 8px;text-align:center;color:#94A3B8;border-bottom:1px solid #E8EEF5;font-size:10px">'+String(i+1).padStart(2,'0')+'</td>'
      +'<td style="padding:9px 8px;border-bottom:1px solid #E8EEF5;font-size:10.5px;line-height:1.35"><div style="font-weight:600;color:#1E293B">'+(it.desc||'')+'</div>'
      +(subline?'<div style="font-size:9px;color:#64748B;margin-top:2px">'+subline+'</div>':'')
      +(it.specs?'<div style="font-size:9px;color:#64748B;margin-top:2px">'+it.specs+'</div>':'')+'</td>'
      +'<td style="padding:9px 8px;text-align:center;border-bottom:1px solid #E8EEF5;font-size:10.5px">'+it.qty+'</td>'
      +'<td style="padding:9px 8px;text-align:center;border-bottom:1px solid #E8EEF5;font-size:10px;color:#64748B">'+(it.uom||'')+'</td>'
      +'<td style="padding:9px 8px;text-align:right;border-bottom:1px solid #E8EEF5;font-size:10.5px">'+Number(it.up).toLocaleString('en',{minimumFractionDigits:2})+'</td>'
      +'<td style="padding:9px 8px;text-align:right;border-bottom:1px solid #E8EEF5;font-size:10.5px;font-weight:700;color:#1F4E79">'+t.toLocaleString('en',{minimumFractionDigits:2})+'</td></tr>';
  }).join('');
  const meta=function(k,v){return '<div style="padding:8px 10px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px"><div style="font-size:8px;color:#64748B;text-transform:uppercase;letter-spacing:.9px;font-weight:700">'+k+'</div><div style="font-size:10.5px;color:#1F4E79;font-weight:800;margin-top:2px">'+v+'</div></div>';};
  const tot=function(k,v,bold){return '<div style="display:flex;justify-content:space-between;padding:6px 12px;border-bottom:1px solid #E2E8F0;font-size:10.5px"><span style="color:#64748B">'+k+'</span><span style="font-weight:'+(bold?'800':'600')+';color:#1E293B">'+v+'</span></div>';};
  const html='<!DOCTYPE html><html><head><title>'+q.qno+'</title><meta charset="UTF-8"><style>'
+'*{box-sizing:border-box;margin:0;padding:0}'
+'body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#1E293B;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
+'@media print{@page{size:A4;margin:10mm 12mm 18mm 12mm;@bottom-right{content:"Page " counter(page) " of " counter(pages);font-family:Arial;font-size:8pt;color:#64748B}}.pw{box-shadow:none!important}}'
+'@media screen{body{background:#d0d0d0;padding:20px 0}.pw{box-shadow:0 4px 20px rgba(0,0,0,.20)}}'
+'.pw{width:210mm;margin:0 auto;background:#fff;border-collapse:collapse;table-layout:fixed}.pw td{vertical-align:top}.accent{border-left:6px solid #1F4E79;padding-left:14px}'
+'.quote-items thead{display:table-header-group}.quote-items tr{page-break-inside:avoid;break-inside:avoid}.quote-items tbody td,.quote-items tbody td *{color:#000!important;font-weight:400!important}'
+'</style></head><body><table class="pw"><tfoot><tr><td style="padding:0"><div style="border-top:1px solid #CBD5E1;padding:6px 12mm 4px;font-size:9.5px;color:#64748B;display:flex;justify-content:space-between;line-height:1.5"><span>'+f1+'</span><span>'+f2+'</span></div></td></tr></tfoot><tbody><tr><td style="padding:0">'
+'<div style="padding:18px 12mm 12px;display:grid;grid-template-columns:1.2fr .8fr;gap:18px;align-items:start">'
+'<div class="accent">'+(settings.logo?'<img src="'+settings.logo+'" style="height:48px;width:auto;max-width:220px;object-fit:contain;margin-bottom:8px">':'<div style="font-size:18px;font-weight:900;color:#1F4E79;margin-bottom:8px">'+co+'</div>')
+'<div style="font-size:10px;color:#475569;line-height:1.55">'+headerInfo+'</div></div>'
+'<div style="text-align:right"><div style="font-size:12px;color:#64748B;letter-spacing:2px;text-transform:uppercase;font-weight:800">Quotation</div><div style="font-size:24px;font-weight:900;color:#1F4E79;margin-top:4px">'+q.qno+'</div>'
+(q.ref?'<div style="font-size:10px;color:#8A6D1D;font-weight:800;margin-top:2px">Client Ref: '+q.ref+'</div>':'')
+'<div style="height:3px;background:#D4AF37;width:88px;margin:8px 0 8px auto"></div><div style="font-size:10px;color:#64748B">Issued: <b style="color:#1E293B">'+fmtDate(q.date)+'</b><br>Valid until: <b style="color:#1E293B">'+fmtDate(vu)+'</b></div></div></div>'
+'<div style="margin:0 12mm 12px;padding:12px 14px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;display:grid;grid-template-columns:1.4fr 1fr;gap:14px">'
+'<div><div style="font-size:8px;color:#64748B;text-transform:uppercase;letter-spacing:1.2px;font-weight:800;margin-bottom:4px">Customer</div><div style="font-size:14px;font-weight:900;color:#1F4E79">'+q.company+'</div>'+(q.contact?'<div style="font-size:10px;color:#475569;margin-top:2px">Attention: '+q.contact+'</div>':'')+(q.project?'<div style="font-size:10px;color:#64748B;margin-top:2px">Project: '+q.project+'</div>':'')+'</div>'
+'<div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">'+meta('Validity',(q.validity||7)+' days')+meta('Delivery',q.delivery||'—')+meta('Payment',q.payment||'—')+meta('Currency','SAR')+'</div></div>'
+'<div style="padding:0 12mm"><table class="quote-items" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #D9E2EC;border-radius:10px;overflow:hidden"><thead><tr style="background:#1F4E79"><th style="padding:9px 8px;color:#fff;font-size:9px;text-align:center;width:34px">#</th><th style="padding:9px 8px;color:#fff;font-size:9px;text-align:left">DESCRIPTION</th><th style="padding:9px 8px;color:#fff;font-size:9px;text-align:center;width:46px">QTY</th><th style="padding:9px 8px;color:#fff;font-size:9px;text-align:center;width:48px">UOM</th><th style="padding:9px 8px;color:#fff;font-size:9px;text-align:right;width:86px">UNIT PRICE</th><th style="padding:9px 8px;color:#fff;font-size:9px;text-align:right;width:92px">AMOUNT</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
+'<div style="display:grid;grid-template-columns:1fr 285px;gap:18px;padding:12px 12mm 0;page-break-inside:avoid"><div style="background:#FFFDF5;border:1px solid #EAD99B;border-radius:10px;padding:10px 12px"><div style="font-size:8px;text-transform:uppercase;letter-spacing:1.2px;color:#8A6D1D;font-weight:900;margin-bottom:5px">Terms &amp; Conditions</div><ul style="padding-left:15px;color:#475569;font-size:10px;line-height:1.55"><li>This quotation is valid for '+(q.validity||7)+' days from date of issue.</li><li>Delivery: '+(q.delivery||'—')+'</li><li>Payment: '+(q.payment||'—')+'</li><li>Stock and prices are subject to availability at order confirmation.</li></ul></div><div style="border:1px solid #D9E2EC;border-radius:10px;overflow:hidden;background:#fff">'+tot('Sub-total',fmt(sub))+ (disc>0?tot('Discount','− '+fmt(disc))+tot('Total before VAT',fmt(bvat),true):'') +tot('VAT ('+getQuoteVatPercent(q)+'%)',fmt(vat))+'<div style="background:#1F4E79;color:#fff;padding:13px 12px;display:flex;justify-content:space-between;align-items:center"><span style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#DCEBFA;font-weight:800">Net Amount</span><span style="font-size:18px;font-weight:900">'+fmt(net)+'</span></div></div></div>'
+(q.notes?'<div style="margin:10px 12mm 0;padding:9px 12px;background:#EFF6FF;border-left:4px solid #1F4E79;font-size:10px;color:#334155"><strong>Notes:</strong> '+q.notes+'</div>':'')
+'<div style="display:grid;grid-template-columns:1fr 1fr;gap:55px;margin:15mm 12mm 10px;page-break-inside:avoid"><div style="border-top:1.5px solid #1F4E79;padding-top:6px;font-size:9px;color:#64748B;font-weight:700">CUSTOMER ACCEPTANCE &amp; SIGNATURE</div><div style="border-top:1.5px solid #1F4E79;padding-top:6px;font-size:9px;color:#64748B;font-weight:700">AUTHORISED SIGNATURE — '+co.toUpperCase()+'</div></div>'
+'<div style="margin:8px 12mm 10px;text-align:center;font-size:10px;line-height:1.5;color:#64748B;font-style:italic;page-break-inside:avoid">Thank you for the opportunity to quote. We look forward to serving you.<br><span style="font-size:9.5px;color:#6B7280">If you have any questions regarding this quotation, please feel free to contact us.</span></div>'
+'</td></tr></tbody></table><scr'+'ipt>window.onload=function(){setTimeout(function(){window.print()},600)}<'+'/script></body></html>';
  _tplOpen(html);
}

/* ══════════ TEMPLATE 4: ARABIC / ENGLISH ══════════ */
function printQuotationBilingual(id) {
  const d=_tplData(id); if(!d) return;
  const {q,sub,disc,bvat,vat,net,vu,co,f1,f2,headerInfo}=d;
  const coAr='\u062f\u0627\u0648\u0646 \u062a\u0627\u0648\u0646 \u0644\u0644\u062a\u062c\u0627\u0631\u0629';
  const rows=(q.items||[]).map(function(it,i){
    if(it.lineType==='heading') return '<tr><td colspan="99" style="padding:7px 8px;background:#EEF4FB;color:#1F4E79;font-weight:800;border-top:1px solid #CBD5E1;border-bottom:1px solid #CBD5E1">'+escapeHtml(it.text||it.desc||'')+'</td></tr>';
    if(it.lineType==='note') return '<tr><td></td><td colspan="98" style="padding:6px 8px;background:#FFFBEA;color:#475569;font-style:italic;border-top:1px solid #EADFAE;border-bottom:1px solid #EADFAE">Note: '+escapeHtml(it.text||it.desc||'')+'</td></tr>';
    const t=(parseFloat(it.qty)||0)*(parseFloat(it.up)||0);
    return '<tr style="'+(i%2===0?'background:#FFF9F0':'background:#fff')+'">'
      +'<td style="padding:6px 8px;text-align:center;font-size:10px;color:#888;border-bottom:1px solid #ede0cc">'+String(i+1).padStart(2,'0')+'</td>'
      +'<td style="padding:6px 8px;font-size:10.5px;border-bottom:1px solid #ede0cc">'+(it.desc||'')+'</td>'
      +'<td style="padding:6px 8px;text-align:center;font-size:10.5px;border-bottom:1px solid #ede0cc">'+it.qty+'</td>'
      +'<td style="padding:6px 8px;text-align:center;font-size:10px;color:#666;border-bottom:1px solid #ede0cc">'+(it.uom||'')+'</td>'
      +'<td style="padding:6px 8px;text-align:right;font-size:10.5px;border-bottom:1px solid #ede0cc">'+Number(it.up).toLocaleString('en',{minimumFractionDigits:2})+'</td>'
      +'<td style="padding:6px 8px;text-align:right;font-size:10.5px;font-weight:600;border-bottom:1px solid #ede0cc">'+t.toLocaleString('en',{minimumFractionDigits:2})+'</td></tr>';
  }).join('');
  // Arabic labels
  const AR={q:'\u0639\u0631\u0636 \u0633\u0639\u0631',prep:'\u0627\u0644\u0639\u0645\u064a\u0644',ref:'\u0627\u0644\u0645\u0631\u062c\u0639',
    val:'\u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0629',del:'\u0627\u0644\u062a\u0633\u0644\u064a\u0645',pay:'\u0627\u0644\u062f\u0641\u0639',
    desc:'\u0627\u0644\u0628\u064a\u0627\u0646',qty:'\u0627\u0644\u0643\u0645\u064a\u0629',uom:'\u0627\u0644\u0648\u062d\u062f\u0629',
    price:'\u0633\u0639\u0631 \u0627\u0644\u0648\u062d\u062f\u0629',amt:'\u0627\u0644\u0645\u0628\u0644\u063a',
    subt:'\u0627\u0644\u0645\u062c\u0645\u0648\u0639',discl:'\u062e\u0635\u0645',
    b4vat:'\u0627\u0644\u0645\u062c\u0645\u0648\u0639 \u0642\u0628\u0644 \u0627\u0644\u0636\u0631\u064a\u0628\u0629',
    vatl:'\u0636\u0631\u064a\u0628\u0629 \u0627\u0644\u0642\u064a\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629',
    netl:'\u0635\u0627\u0641\u064a \u0627\u0644\u0645\u0628\u0644\u063a',
    terms:'\u0627\u0644\u0634\u0631\u0648\u0637 \u0648\u0627\u0644\u0623\u062d\u0643\u0627\u0645',
    custsig:'\u062a\u0648\u0642\u064a\u0639 \u0648\u0627\u0639\u062a\u0645\u0627\u062f \u0627\u0644\u0639\u0645\u064a\u0644',
    authsig:'\u0627\u0644\u062a\u0648\u0642\u064a\u0639 \u0627\u0644\u0645\u0639\u062a\u0645\u062f',
    tax:'\u0636\u0631\u064a\u0628\u0629',crl:'\u0633.\u062a'};
  const totRow=function(en,ar,v,last){
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 12px;'+(last?'':'border-bottom:1px solid #E2D5C0;')+'font-size:10.5px">'
      +'<div><span>'+en+'</span><br><span style="font-size:10px;color:#666;direction:rtl">'+ar+'</span></div>'
      +'<span style="font-weight:600">'+v+'</span></div>';
  };
  const metaCell=function(en,ar,val){
    return '<div><div style="display:flex;justify-content:space-between">'
      +'<span style="font-size:7.5px;color:#8B98A8;font-weight:700;text-transform:uppercase">'+en+'</span>'
      +'<span style="font-size:11px;color:#8B98A8;font-weight:700;direction:rtl">'+ar+'</span></div>'
      +'<div style="font-size:10px;font-weight:600;color:#0B539D;margin-top:1px">'+val+'</div></div>';
  };
  const html='<!DOCTYPE html><html><head><title>'+q.qno+'</title><meta charset="UTF-8"><style>'
+'*{box-sizing:border-box;margin:0;padding:0}'
+'body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#1a1a1a;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
+'.ar{direction:rtl}'
+'@media print{@page{size:A4;margin:10mm 12mm 18mm 12mm;@bottom-right{content:"Page " counter(page) " of " counter(pages);font-family:Arial;font-size:8pt;color:#555}}'
+'tfoot td{padding:0 !important}.pw{box-shadow:none !important}}'
+'@media screen{body{background:#d0d0d0;padding:20px 0}.pw{box-shadow:0 4px 20px rgba(0,0,0,.2)}}'
+'.pw{width:210mm;margin:0 auto;background:#fff;border-collapse:collapse;table-layout:fixed}'
+'.pw>tfoot>tr>td,.pw>tbody>tr>td{padding:0;vertical-align:top}'
+'.quote-items thead{display:table-header-group}.quote-items tr{page-break-inside:avoid;break-inside:avoid}.quote-items tbody td,.quote-items tbody td *{color:#000!important;font-weight:400!important}'
+'</style></head><body><table class="pw">'
+'<tfoot><tr><td><div style="border-top:1.5px solid #0B539D;padding:5px 12mm 4px;font-size:10.5px;color:#444;background:#fff;display:flex;justify-content:space-between;line-height:1.6;font-weight:500">'
+'<span>'+f1+'</span><span>'+f2+'</span></div></td></tr></tfoot>'
+'<tbody><tr><td>'
// Arabic header
+'<div style="background:#0B539D;padding:16px 12mm;border-bottom:4px solid #F15A25">'
+'<div style="display:flex;justify-content:space-between;align-items:center">'
+'<div style="display:flex;align-items:center;gap:12px">'
+(settings.logo?'<div style="background:#fff;border-radius:5px;padding:5px 10px;box-shadow:0 2px 5px rgba(0,0,0,.2)"><img src="'+settings.logo+'" style="height:46px;width:auto;max-width:195px;object-fit:contain"></div>':'')
+'<div><div style="color:#fff;font-size:13px;font-weight:700">'+co+'</div>'
+'<div class="ar" style="color:#CFE2F4;font-size:17px;margin-top:2px;text-align:left;font-weight:700">'+coAr+'</div>'
+'<div style="color:#CFE2F4;font-size:8.5px;margin-top:3px">'
+headerInfo
+'</div></div></div>'
+'<div style="text-align:right">'
+'<div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;margin-bottom:6px">'
+'<span style="background:#F15A25;color:#fff;font-size:13px;padding:4px 10px;border-radius:3px;letter-spacing:1.4px;font-weight:800">QUOTATION</span>'
+'<span class="ar" style="background:#F15A25;color:#fff;font-size:13px;padding:4px 10px;border-radius:3px;font-weight:800">'+AR.q+'</span></div>'
+'<div style="color:#fff;font-size:16px;font-weight:800">'+q.qno+'</div>'
+(q.ref?'<div style="color:#FFD08A;font-size:9.5px;font-weight:800;margin-top:2px">Client Ref: '+q.ref+'</div>':'')
+'<div style="color:#CFE2F4;font-size:8.5px;margin-top:3px">Issued: '+fmtDate(q.date)+' &nbsp;\u00b7&nbsp; Valid: '+fmtDate(vu)+'</div>'
+'</div></div></div>'
// Bilingual meta
+'<div style="display:grid;grid-template-columns:1.3fr 1fr;margin:8px 12mm 10px;border:1px solid #E2D5C0">'
+'<div style="padding:10px 14px;border-right:1px solid #E2D5C0">'
+'<div style="display:flex;justify-content:space-between;margin-bottom:4px">'
+'<span style="font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#8B98A8;font-weight:700">Customer</span>'
+'<span class="ar" style="font-size:8px;color:#8B98A8;font-weight:700">'+AR.prep+'</span></div>'
+'<div style="font-size:12px;font-weight:700;color:#0B539D">'+q.company+'</div>'
+(q.contact?'<div style="font-size:10px;color:#555;margin-top:2px">Attention: '+q.contact+'</div>':'')
+(q.project?'<div style="font-size:10px;color:#555">Project: '+q.project+'</div>':'')
+(q.city?'<div style="font-size:10px;color:#555">'+q.city+'</div>':'')+'</div>'
+'<div style="padding:10px 14px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 10px">'
+metaCell('Validity',AR.val,(q.validity||7)+' days')
+metaCell('Currency','العملة','SAR')
+metaCell('Delivery',AR.del,q.delivery||'\u2014')
+metaCell('Payment',AR.pay,q.payment||'\u2014')
+'</div></div></div>'
// Bilingual items table
+'<div style="padding:0 12mm"><table class="quote-items" style="width:100%;border-collapse:collapse">'
+'<thead><tr style="background:#0B539D">'
+'<th style="padding:6px 8px;color:#fff;font-size:8.5px;text-align:center;width:28px">#</th>'
+'<th style="padding:6px 8px;color:#fff;font-size:8.5px;text-align:left">Description <span class="ar" style="font-size:11px;color:#CFE2F4;font-weight:600">/ '+AR.desc+'</span></th>'
+'<th style="padding:6px 8px;color:#fff;font-size:8.5px;text-align:center;width:46px">Qty<span class="ar" style="font-size:10.5px;color:#CFE2F4;display:block;font-weight:600">'+AR.qty+'</span></th>'
+'<th style="padding:6px 8px;color:#fff;font-size:8.5px;text-align:center;width:46px">UOM<span class="ar" style="font-size:10.5px;color:#CFE2F4;display:block;font-weight:600">'+AR.uom+'</span></th>'
+'<th style="padding:6px 8px;color:#fff;font-size:8.5px;text-align:right;width:84px">Unit Price<span class="ar" style="font-size:10.5px;color:#CFE2F4;display:block;font-weight:600">'+AR.price+'</span></th>'
+'<th style="padding:6px 8px;color:#fff;font-size:8.5px;text-align:right;width:88px">Amount<span class="ar" style="font-size:10.5px;color:#CFE2F4;display:block;font-weight:600">'+AR.amt+'</span></th>'
+'</tr></thead><tbody>'+rows+'</tbody></table></div>'
// Bilingual totals
+'<div style="display:flex;justify-content:flex-end;padding:10px 12mm;page-break-inside:avoid">'
+'<div style="width:290px;border:1px solid #E2D5C0;overflow:hidden">'
+totRow('Sub-total',AR.subt,fmt(sub))
+(disc>0?totRow('Discount',AR.discl,'\u2212 '+fmt(disc))+totRow('Total before VAT',AR.b4vat,fmt(bvat)):'')
+totRow('VAT ('+getQuoteVatPercent(q)+'%)',AR.vatl,fmt(vat),true)
+'<div style="background:#0B539D;color:#fff;padding:10px 12px;display:flex;justify-content:space-between;align-items:center">'
+'<div><div style="font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:#BFDCF2">Net Amount</div>'
+'<div class="ar" style="font-size:10.5px;color:#BFDCF2;margin-top:1px;text-align:left">'+AR.netl+'</div></div>'
+'<span style="font-size:15px;font-weight:800">'+fmt(net)+'</span></div></div></div>'
// Bilingual terms
+'<div style="margin:0 12mm;padding:10px 13px;background:#FFF9F0;border-left:3px solid #F15A25;page-break-inside:avoid">'
+'<div style="display:flex;justify-content:space-between;margin-bottom:6px">'
+'<span style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#0B539D">Terms &amp; Conditions</span>'
+'<span class="ar" style="font-size:11.5px;font-weight:700;color:#0B539D">'+AR.terms+'</span></div>'
+'<ul style="padding-left:14px;color:#555;font-size:10px">'
+'<li style="margin-bottom:2px">This quotation is valid for '+(q.validity||7)+' days from the date of issue.</li>'
+'<li style="margin-bottom:2px">Delivery / '+AR.del+': '+(q.delivery||'\u2014')+'</li>'
+'<li style="margin-bottom:2px">Payment / '+AR.pay+': '+(q.payment||'\u2014')+'</li>'
+'<li>Stock subject to availability at the time of order confirmation.</li></ul></div>'
+(q.notes?'<div style="margin:8px 12mm 0;padding:8px 12px;background:#fffbea;border:1px solid #F0D77B;font-size:10px"><strong>Notes:</strong> '+q.notes+'</div>':'')
// Bilingual signature
+'<div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin:15mm 12mm 8px;page-break-inside:avoid">'
+'<div style="border-top:1px solid #2B2B2B;padding-top:5px">'
+'<div style="font-size:8.5px;color:#888">CUSTOMER ACCEPTANCE &amp; SIGNATURE</div>'
+'<div class="ar" style="font-size:11.5px;color:#555;margin-top:1px;text-align:left">'+AR.custsig+'</div></div>'
+'<div style="border-top:1px solid #2B2B2B;padding-top:5px">'
+'<div style="font-size:8.5px;color:#888">AUTHORISED SIGNATURE \u2014 '+co.toUpperCase()+'</div>'
+'<div class="ar" style="font-size:11.5px;color:#555;margin-top:1px;text-align:left">'+AR.authsig+' \u2014 '+coAr+'</div></div></div>'
+'<div style="margin:8px 12mm 10px;text-align:center;font-size:10px;line-height:1.5;color:#64748B;font-style:italic;page-break-inside:avoid">Thank you for the opportunity to quote. We look forward to serving you.<br><span style="font-size:9.5px;color:#6B7280">If you have any questions regarding this quotation, please feel free to contact us.</span></div>'
+'</td></tr></tbody></table>'
+'<scr'+'ipt>window.onload=function(){setTimeout(function(){window.print()},600)}<'+'/script>'
+'</body></html>';
  _tplOpen(html);
}




/* ══════════════════════════════════════════════════
   PHASE 1 · STEP 2 — PREMIUM TOP HEADER
══════════════════════════════════════════════════ */
const TOPBAR_CONTEXT={
  Dashboard:{group:'',action:null},
  RFQs:{group:'Sales',action:null},
  Pricing:{group:'Sales',action:null},
  Quotations:{group:'Sales',action:null},
  'Sales Orders':{group:'Sales',action:null},'Delivery Notes':{group:'Sales',action:null},Invoices:{group:'Sales',action:null},
  'Supplier RFQs':{group:'Purchasing',action:null},'Purchase Orders':{group:'Purchasing',action:null},'Purchase Invoices':{group:'Purchasing',action:null},
  'Master Data':{group:'',action:null},Customers:{group:'Master Data',action:{label:'New Customer',icon:'ti-plus',run:()=>openAddCustomer()}},Suppliers:{group:'Master Data',action:{label:'New Supplier',icon:'ti-plus',run:()=>openAddSupplier()}},Products:{group:'Master Data',action:{label:'New Product',icon:'ti-plus',run:()=>openAddProduct()}},Employees:{group:'Master Data',action:{label:'New Employee',icon:'ti-user-plus',run:()=>openEmployeeForm()}},'Units of Measure':{group:'Master Data',action:null},
  Reports:{group:'',action:null},Administration:{group:'',action:null},Users:{group:'Administration',action:{label:'New User',icon:'ti-user-plus',run:()=>openUserForm()}},'System Preferences':{group:'Administration',action:null}
};
let topbarPrimaryAction=null;
function getTopbarContext(title){return TOPBAR_CONTEXT[title]||{group:inferTopbarGroup(title),action:null};}
function inferTopbarGroup(title){
  const active=document.querySelector('.nav-item.active');
  const group=active?.closest('.nav-group')?.querySelector('.nav-group-toggle .nav-text')?.textContent?.trim();
  if(group)return group;
  if(['Customers','Suppliers','Products','Employees','Units of Measure'].includes(title))return'Master Data';
  return'';
}
const BREADCRUMB_GROUP_TARGETS={
  Sales:'rfq',
  Purchasing:'supplierrfqs',
  'Master Data':'masters',
  Administration:'setup',
  Reports:'analytics'
};
function breadcrumbGroupTarget(group){return BREADCRUMB_GROUP_TARGETS[group]||'dashboard';}
function updateTopbarContext(){
  const title=(document.getElementById('page-title')?.textContent||'Dashboard').trim();
  const ctx=getTopbarContext(title), crumb=document.getElementById('topbar-breadcrumb');
  if(crumb){
    let html='<button class="breadcrumb-item breadcrumb-home" type="button" onclick="showPage(\'dashboard\')" aria-label="Go to Dashboard"><i class="ti ti-home"></i><span>Dashboard</span></button>';
    if(title==='Dashboard'){
      html='<span class="crumb-current" aria-current="page">Overview</span>';
    }else{
      if(ctx.group&&ctx.group!==title){
        const groupTarget=breadcrumbGroupTarget(ctx.group);
        html+='<span class="crumb-separator" aria-hidden="true"><i class="ti ti-chevron-right"></i></span>'+
          '<button class="breadcrumb-item breadcrumb-parent" type="button" onclick="showPage(\''+groupTarget+'\')">'+escapeHtml(ctx.group)+'</button>';
      }
      html+='<span class="crumb-separator" aria-hidden="true"><i class="ti ti-chevron-right"></i></span>'+
        '<span class="crumb-current" aria-current="page">'+escapeHtml(title)+'</span>';
    }
    crumb.innerHTML=html;
  }
  const btn=document.getElementById('topbar-primary-action');topbarPrimaryAction=ctx.action||null;
  if(btn&&topbarPrimaryAction){btn.style.display='inline-flex';btn.querySelector('span').textContent=topbarPrimaryAction.label;btn.querySelector('i').className='ti '+(topbarPrimaryAction.icon||'ti-plus');}
  else if(btn)btn.style.display='none';
  refreshTopbarNotifications();
}
function runTopbarPrimaryAction(){if(topbarPrimaryAction?.run)topbarPrimaryAction.run();}
const TOPBAR_SEARCH_PAGES=[
  ['dashboard','Dashboard','Overview and business summary','ti-layout-dashboard'],['rfq','RFQs','Sales requests for quotation','ti-inbox'],['costing','Pricing','Supplier pricing and costing','ti-calculator'],['quotations','Quotations','Customer quotations','ti-file-text'],['salesorders','Sales Orders','Confirmed customer orders','ti-shopping-cart'],['deliverynotes','Delivery Notes','Material deliveries','ti-truck-delivery'],['customerinvoices','Invoices','Customer invoices','ti-receipt'],['supplierrfqs','Supplier RFQs','Purchasing enquiries','ti-file-search'],['purchaseorders','Purchase Orders','Supplier orders','ti-clipboard-check'],['purchaseinvoices','Purchase Invoices','Supplier invoices','ti-file-invoice'],['masters','Master Data','Customers, suppliers, products and employees','ti-database'],['analytics','Reports','Business reports and analytics','ti-chart-bar'],['setup','Administration','Company and system settings','ti-settings-cog']
];
let globalSearchSelection=0;
function handleGlobalSearch(value){
  const box=document.getElementById('global-search-results');if(!box)return;
  const q=(value||'').trim().toLowerCase();
  if(!q){box.classList.remove('show');box.innerHTML='';return;}
  const results=TOPBAR_SEARCH_PAGES.filter(x=>(x[1]+' '+x[2]).toLowerCase().includes(q)).slice(0,8);globalSearchSelection=0;
  box.innerHTML=results.length?results.map((x,i)=>'<button type="button" class="global-search-result '+(i===0?'selected':'')+'" data-search-page="'+x[0]+'"><i class="ti '+x[3]+'"></i><span><strong>'+escapeHtml(x[1])+'</strong><small>'+escapeHtml(x[2])+'</small></span></button>').join(''):'<div class="global-search-empty">No matching page found</div>';
  box.classList.add('show');box.querySelectorAll('[data-search-page]').forEach(b=>b.addEventListener('click',()=>selectGlobalSearchResult(b.dataset.searchPage)));
}
function selectGlobalSearchResult(page){showPage(page);const input=document.getElementById('global-search');if(input)input.value='';document.getElementById('global-search-results')?.classList.remove('show');}
function handleGlobalSearchKey(e){
  const box=document.getElementById('global-search-results'),items=Array.from(box?.querySelectorAll('.global-search-result')||[]);if(!items.length)return;
  if(e.key==='ArrowDown'){e.preventDefault();globalSearchSelection=(globalSearchSelection+1)%items.length;}
  else if(e.key==='ArrowUp'){e.preventDefault();globalSearchSelection=(globalSearchSelection-1+items.length)%items.length;}
  else if(e.key==='Enter'){e.preventDefault();items[globalSearchSelection]?.click();return;}else if(e.key==='Escape'){box.classList.remove('show');return;}else return;
  items.forEach((x,i)=>x.classList.toggle('selected',i===globalSearchSelection));items[globalSearchSelection]?.scrollIntoView({block:'nearest'});
}
function toggleTopbarMenu(id){
  const target=document.getElementById(id),wasOpen=target?.classList.contains('show');closeTopbarMenus();if(target&&!wasOpen)target.classList.add('show');
}
function closeTopbarMenus(){document.querySelectorAll('.topbar-dropdown.show').forEach(x=>x.classList.remove('show'));}
function refreshTopbarNotifications(){
  const entries=[];
  const badge=(id)=>{const e=document.getElementById(id);return e&&e.style.display!=='none'?(e.textContent||'').trim():''};
  if(badge('rfq-badge'))entries.push(['ti-inbox',badge('rfq-badge')+' new RFQ(s)','Review newly received customer requests']);
  if(badge('pricing-badge'))entries.push(['ti-calculator',badge('pricing-badge')+' item(s) awaiting pricing','Continue supplier pricing and costing']);
  if(badge('so-badge'))entries.push(['ti-shopping-cart',badge('so-badge')+' sales order update(s)','Review pending sales-order activity']);
  const list=document.getElementById('topbar-notification-list'),dot=document.getElementById('topbar-alert-dot');if(!list)return;
  list.innerHTML=entries.length?entries.map(x=>'<div class="topbar-notification"><i class="ti '+x[0]+'"></i><div><strong>'+escapeHtml(x[1])+'</strong><small>'+escapeHtml(x[2])+'</small></div></div>').join(''):'<div class="topbar-notification-empty"><i class="ti ti-circle-check" style="font-size:22px;display:block;margin-bottom:6px"></i>No pending notifications</div>';
  dot?.classList.toggle('show',entries.length>0);
}
function initPremiumTopbar(){
  const title=document.getElementById('page-title');if(title)new MutationObserver(updateTopbarContext).observe(title,{childList:true,characterData:true,subtree:true});
  document.addEventListener('click',e=>{if(!e.target.closest('.topbar-menu-wrap'))closeTopbarMenus();if(!e.target.closest('.global-search-wrap'))document.getElementById('global-search-results')?.classList.remove('show');});
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();document.getElementById('global-search')?.focus();}if(e.key==='Escape')closeTopbarMenus();});
  updateTopbarContext();setTimeout(refreshTopbarNotifications,250);
}

loadThemeAndFont();
initPremiumSidebar();
initPremiumTopbar();
loadRecycleBin();
loadData().then(function() {
  // Deep links are authoritative. Never let normal last-page restoration
  // (for example Pricing) override a Delivery Note QR destination.
  const dnDeepLink = new URLSearchParams(location.search).get('dn');
  if (dnDeepLink) {
    if (typeof openDNFromDeepLink === 'function') openDNFromDeepLink();
    return;
  }

  // After ordinary startup, restore the page the user was on before refresh.
  try {
    const lastPage = localStorage.getItem('bc_last_nav_page');
    if (lastPage && lastPage !== 'dashboard') {
      setTimeout(function() {
        // Re-check in case a deep link was introduced while startup completed.
        if (new URLSearchParams(location.search).get('dn')) return;
        if (typeof showPage === 'function') showPage(lastPage);
      }, 300);
    }
  } catch(e) {}
});
initialiseCostComponents(true);
initMarginStatuses();
initPricingSettings();


/* Secondary navigation keyboard behavior */
document.addEventListener('keydown',function(event){
  const current=event.target.closest?.('.setup-nav .setup-tab');
  if(!current)return;
  const nav=current.closest('.setup-nav');
  const buttons=[...nav.querySelectorAll('.setup-tab')].filter(btn=>btn.offsetParent!==null);
  const index=buttons.indexOf(current);
  if(index<0)return;
  let target=null;
  if(event.key==='ArrowDown')target=buttons[(index+1)%buttons.length];
  else if(event.key==='ArrowUp')target=buttons[(index-1+buttons.length)%buttons.length];
  else if(event.key==='Home')target=buttons[0];
  else if(event.key==='End')target=buttons[buttons.length-1];
  else return;
  event.preventDefault();
  target.focus();
});

document.addEventListener('DOMContentLoaded',function(){
  document.querySelectorAll('.setup-nav').forEach(nav=>{
    nav.setAttribute('role','tablist');
    nav.setAttribute('aria-orientation','vertical');
    nav.querySelectorAll('.setup-tab').forEach(button=>{
      button.setAttribute('role','tab');
      const active=button.classList.contains('active');
      button.setAttribute('aria-selected',active?'true':'false');
      button.tabIndex=active?0:-1;
    });
  });
});

document.addEventListener('DOMContentLoaded',restoreRFQMainMonitor);

/* ── BIZCORE TASK-AWARE WORKSPACES ────────────────────────── */
const modalDefaultWorkspace = {
  'pricing-modal':'fullscreen',
  'quote-modal':'normal',
  'pricing-ro-modal':'fullscreen',
  'so-create-modal':'fullscreen',
  'so-view-modal':'normal',
  'rfq-view-modal':'normal',
  'view-modal':'normal',
  'dn-print-modal':'fullscreen',
  'cust-modal':'compact',
  'prod-modal':'normal',
  'sup-modal':'compact'
};

function workspaceModeName(size){ return size==='fullscreen' ? 'Focus' : 'Standard'; }

function setWorkspaceMode(modalId, mode){
  setModalSize(modalId, mode==='focus' ? 'fullscreen' : 'normal');
  const overlay=document.getElementById(modalId);
  overlay?.querySelectorAll('.workspace-mode-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.mode===mode));
}

async function toggleBrowserFullscreen(){
  try{
    if(!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  }catch(err){ showToast('Browser full screen is not available here.','error'); }
}

function buildWorkspaceControls(overlay){
  const modalId=overlay.id;
  const header=overlay.querySelector('.modal-header');
  if(!header || header.querySelector('.workspace-controls')) return;
  const closeBtn=header.querySelector(':scope > .close-btn, :scope > * > .close-btn');
  if(!closeBtn) return;

  // Keep title/content separate from the right-side workspace actions.
  let actionWrap=closeBtn.closest('.workspace-header-actions');
  if(!actionWrap){
    actionWrap=document.createElement('div');
    actionWrap.className='workspace-header-actions';
    closeBtn.parentNode.insertBefore(actionWrap,closeBtn);
    actionWrap.appendChild(closeBtn);
  }
  actionWrap.querySelectorAll('.modal-size-btn').forEach(btn=>btn.remove());

  const controls=document.createElement('div');
  controls.className='workspace-controls';
  controls.innerHTML=`
    <div class="workspace-mode-switch" role="group" aria-label="Workspace size">
      <button type="button" class="workspace-mode-btn" data-mode="standard" title="Standard workspace"><i class="ti ti-layout-dashboard"></i><span>Standard</span></button>
      <button type="button" class="workspace-mode-btn" data-mode="focus" title="Focus workspace"><i class="ti ti-maximize"></i><span>Focus</span></button>
    </div>
    <button type="button" class="workspace-icon-btn" data-browser-fullscreen title="Use browser full screen"><i class="ti ti-arrows-maximize"></i></button>`;
  controls.querySelector('[data-mode="standard"]').onclick=()=>setWorkspaceMode(modalId,'standard');
  controls.querySelector('[data-mode="focus"]').onclick=()=>setWorkspaceMode(modalId,'focus');
  controls.querySelector('[data-browser-fullscreen]').onclick=toggleBrowserFullscreen;

  closeBtn.classList.add('workspace-close-btn');
  closeBtn.setAttribute('title','Close');
  closeBtn.setAttribute('aria-label','Close');
  closeBtn.innerHTML='<i class="ti ti-x"></i>';

  // Required order: status → Standard/Focus/Fullscreen → Close.
  actionWrap.insertBefore(controls,closeBtn);
  const currentMode=overlay.classList.contains('modal-fs-overlay')?'focus':'standard';
  controls.querySelector(`[data-mode="${currentMode}"]`)?.classList.add('active');
}

function initialiseWorkspaceControls(){
  document.querySelectorAll('.modal-overlay').forEach(overlay=>{
    if(!['confirm-modal','validation-dialog','template-picker-modal','rfq-modal'].includes(overlay.id)) buildWorkspaceControls(overlay);
  });
  document.addEventListener('fullscreenchange',()=>{
    document.querySelectorAll('[data-browser-fullscreen] i').forEach(icon=>{
      icon.className=document.fullscreenElement?'ti ti-arrows-minimize':'ti ti-arrows-maximize';
    });
  });
}

document.addEventListener('DOMContentLoaded',initialiseWorkspaceControls);

/* ═══════════════════════════════════════════════════════════════
   BIZCORE SAFE EXIT + AUTO-SAVE DRAFTS (GLOBAL UX STANDARD 1.0)
   Protects data-entry modals without changing read-only viewers.
═══════════════════════════════════════════════════════════════ */
(() => {
  const ENTRY_MODAL_IDS = new Set([
    'rfq-modal','quote-modal','cust-modal','prod-modal','sup-modal','employee-modal',
    'pricing-modal','so-modal','dn-modal','invoice-modal','po-modal','pi-modal',
    'user-modal','role-modal','unit-modal','warehouse-modal','category-modal'
  ]);
  const states = new Map();
  let bypassClose = false;
  let safeDialog = null;

  const q = (root, sel) => root ? root.querySelector(sel) : null;
  const isOpen = el => !!el && (el.classList.contains('open') || getComputedStyle(el).display !== 'none');
  const modalId = el => el?.id || '';
  const storageKey = id => {
    const recordId = getRecordId(id);
    return `bizcore_draft_v1:${id}:${recordId || 'new'}`;
  };
  function getRecordId(id){
    const lookup = {
      'rfq-modal': () => window.editingRFQId,
      'quote-modal': () => window.editingId,
      'cust-modal': () => window.editingCustId,
      'prod-modal': () => window.editingProdId,
      'sup-modal': () => window.editingSupId,
      'employee-modal': () => window.editingEmployeeId,
      'so-modal': () => window.editingSOId,
    };
    try { return lookup[id]?.() || ''; } catch { return ''; }
  }
  function isExisting(id){
    if(getRecordId(id)) return true;
    const root=document.getElementById(id);
    const title=(root?.querySelector('.modal-header h2, .modal-header h3')?.textContent||'').toLowerCase();
    return /\b(edit|update|revise)\b/.test(title);
  }
  function controls(root){
    return [...root.querySelectorAll('input,select,textarea')].filter(el =>
      !el.disabled && el.type !== 'button' && el.type !== 'submit' && el.type !== 'file' &&
      !el.closest('.confirm-overlay,.safe-exit-dialog')
    );
  }
  function controlKey(el, index){ return el.id || el.name || `field_${index}`; }
  function snapshot(root){
    const data = {};
    controls(root).forEach((el,i) => {
      const key=controlKey(el,i);
      if(el.type==='checkbox'||el.type==='radio') data[key]=!!el.checked;
      else data[key]=el.value;
    });
    return JSON.stringify(data);
  }
  function payload(root){
    const data = {};
    controls(root).forEach((el,i) => {
      const key=controlKey(el,i);
      data[key] = (el.type==='checkbox'||el.type==='radio') ? !!el.checked : el.value;
    });
    return { savedAt:new Date().toISOString(), values:data };
  }
  function applyPayload(root, draft){
    const map=draft?.values||{};
    controls(root).forEach((el,i)=>{
      const key=controlKey(el,i);
      if(!(key in map)) return;
      if(el.type==='checkbox'||el.type==='radio') el.checked=!!map[key];
      else el.value=map[key] ?? '';
      el.dispatchEvent(new Event('change',{bubbles:true}));
    });
  }
  function setIndicator(root, text, kind='saved'){
    let el=root.querySelector('.bc-draft-indicator');
    const header=root.querySelector('.modal-header');
    if(!header) return;
    if(!el){
      el=document.createElement('span');
      el.className='bc-draft-indicator';
      const actions=header.querySelector('.workspace-header-actions, .rfq-header-actions');
      if(actions) actions.insertBefore(el,actions.firstChild);
      else header.appendChild(el);
    }
    el.className=`bc-draft-indicator ${kind}`;
    el.innerHTML = kind==='unsaved' ? '<span></span> Unsaved changes' : kind==='draft' ? '<i class="ti ti-cloud-check"></i> Draft saved' : '<i class="ti ti-check"></i> Saved';
    el.title=text||'';
  }
  function saveDraft(id){
    const root=document.getElementById(id), st=states.get(id);
    if(!root||!st?.dirty) return;
    try{
      localStorage.setItem(storageKey(id),JSON.stringify(payload(root)));
      st.lastDraft=Date.now();
      setIndicator(root,'Auto-saved locally','draft');
    }catch(e){ console.warn('BizCore draft could not be saved',e); }
  }
  function clearDraft(id){ try{ localStorage.removeItem(storageKey(id)); }catch{} }
  function markFormDirty(root){
    const id=modalId(root), st=states.get(id); if(!st||st.restoring) return;
    const changed=snapshot(root)!==st.baseline;
    st.dirty=changed;
    if(changed){ setIndicator(root,'Changes not yet permanently saved','unsaved'); scheduleDraft(id); }
    else setIndicator(root,'No unsaved changes','saved');
  }
  function scheduleDraft(id){
    const st=states.get(id); if(!st) return;
    clearTimeout(st.timer); st.timer=setTimeout(()=>saveDraft(id),1200);
  }
  function initialize(root){
    const id=modalId(root); if(!ENTRY_MODAL_IDS.has(id)) return;
    const st={ baseline:snapshot(root),dirty:false,timer:null,restoring:false,lastDraft:0 };
    states.set(id,st); setIndicator(root,'No unsaved changes','saved');
    const raw=localStorage.getItem(storageKey(id));
    if(raw){
      let draft=null; try{draft=JSON.parse(raw);}catch{clearDraft(id);}
      if(draft?.values && Object.keys(draft.values).length){
        showRestoreDialog(root,draft);
      }
    }
  }
  function showRestoreDialog(root,draft){
    const when=draft.savedAt ? new Date(draft.savedAt).toLocaleString() : 'earlier';
    showSafeDialog({
      icon:'ti-history', title:'Restore auto-saved draft?',
      message:`BizCore found unsaved work saved ${when}.`,
      secondary:'Restore it and continue, or discard it and start with the current form.',
      buttons:[
        {text:'Discard draft',cls:'danger-outline',action:()=>clearDraft(root.id)},
        {text:'Restore draft',cls:'primary',action:()=>{
          const st=states.get(root.id); if(st)st.restoring=true;
          applyPayload(root,draft);
          if(st){st.restoring=false;st.dirty=true;}
          setIndicator(root,'Restored auto-saved work','unsaved');
        }}
      ]
    });
  }
  function showSafeDialog({icon,title,message,secondary='',buttons=[]}){
    safeDialog?.remove();
    const wrap=document.createElement('div'); wrap.className='safe-exit-dialog';
    wrap.innerHTML=`<div class="safe-exit-card" role="dialog" aria-modal="true"><div class="safe-exit-icon"><i class="ti ${icon}"></i></div><div class="safe-exit-copy"><h3>${title}</h3><p>${message}</p>${secondary?`<small>${secondary}</small>`:''}</div><div class="safe-exit-actions"></div></div>`;
    const actions=wrap.querySelector('.safe-exit-actions');
    buttons.forEach(b=>{const btn=document.createElement('button');btn.type='button';btn.className=`btn safe-${b.cls||'secondary'}`;btn.textContent=b.text;btn.onclick=()=>{wrap.remove();safeDialog=null;b.action?.();};actions.appendChild(btn);});
    document.body.appendChild(wrap); safeDialog=wrap;
    setTimeout(()=>actions.lastElementChild?.focus(),20);
  }
  window.bizcoreShowSafeDialog=showSafeDialog;
  window.bizcorePerformClose=performClose;

  function findSaveButton(root){
    return [...root.querySelectorAll('.modal-footer button, button')].find(btn=>{
      const t=(btn.textContent||'').trim().toLowerCase();
      return !btn.disabled && (/^(save|update)/.test(t) || t.includes('save changes') || t.includes('save employee')) && !t.includes('draft');
    }) || [...root.querySelectorAll('.modal-footer button, button')].find(btn=>{
      const t=(btn.textContent||'').trim().toLowerCase(); return !btn.disabled && t.includes('save');
    });
  }
  function performClose(id,discard=false){
    const st=states.get(id); if(st){clearTimeout(st.timer);st.dirty=false;}
    if(discard) clearDraft(id);
    bypassClose=true;
    try{ window.closeModal(id); }finally{ bypassClose=false; }
  }
  function requestClose(id){
    const root=document.getElementById(id),st=states.get(id);
    if(!root||!st?.dirty){performClose(id,false);return;}
    saveDraft(id);
    if(isExisting(id)){
      showSafeDialog({icon:'ti-device-floppy',title:'Save changes?',message:'This record has been modified.',secondary:'Choose what should happen before closing.',buttons:[
        {text:'Discard changes',cls:'danger-outline',action:()=>performClose(id,true)},
        {text:'Continue editing',cls:'secondary',action:()=>{}},
        {text:'Save changes',cls:'primary',action:()=>{const btn=findSaveButton(root);if(btn)btn.click();else showToast?.('Please use the form Save button','warning');}}
      ]});
    }else{
      showSafeDialog({icon:'ti-alert-triangle',title:'Discard new record?',message:'You have entered information that has not been saved.',secondary:'Closing now will remove the auto-saved draft and all entered information.',buttons:[
        {text:'Discard record',cls:'danger-outline',action:()=>performClose(id,true)},
        {text:'Continue editing',cls:'primary',action:()=>{}}
      ]});
    }
  }

  // Preserve original closeModal, but guard user-initiated calls through confirmCloseModal and capture handlers.
  const originalConfirm=window.confirmCloseModal;
  window.confirmCloseModal=function(id){ requestClose(id); };
  window.bizcoreSafeClose=requestClose;
  window.bizcoreFormSaved=function(id){
    const root=document.getElementById(id),st=states.get(id); if(!root||!st)return;
    clearTimeout(st.timer); clearDraft(id); st.baseline=snapshot(root);st.dirty=false;setIndicator(root,'Saved','saved');
  };

  document.addEventListener('input',e=>{const root=e.target.closest('.modal-overlay');if(root&&ENTRY_MODAL_IDS.has(root.id))markFormDirty(root);},true);
  document.addEventListener('change',e=>{const root=e.target.closest('.modal-overlay');if(root&&ENTRY_MODAL_IDS.has(root.id))markFormDirty(root);},true);
  document.addEventListener('click',e=>{
    const root=e.target.closest('.modal-overlay'); if(!root||!ENTRY_MODAL_IDS.has(root.id))return;
    const btn=e.target.closest('button'); if(!btn)return;
    const text=(btn.textContent||'').trim().toLowerCase();
    if(btn.classList.contains('close-btn') || text==='cancel' || text==='close'){
      e.preventDefault();e.stopImmediatePropagation();
      if(root.id==='rfq-modal' && typeof window.confirmCancelRFQEntry==='function'){
        window.confirmCancelRFQEntry();
      }else if(root.id==='quote-modal' && typeof window.confirmCancelQuotationEntry==='function'){
        window.confirmCancelQuotationEntry();
      }else if(root.id==='pricing-modal' && typeof window.requestClosePricingEntry==='function'){
        window.requestClosePricingEntry(text==='cancel'?'cancel':'close');
      }else{
        requestClose(root.id);
      }
    }
  },true);
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape'||safeDialog)return;
    // Item/supplier/product dropdowns own Escape while they are open.
    // Do not let the form-level close guard close the entire Pricing screen.
    const lineItemDD=document.getElementById('pricing-line-item-dd');
    const productDD=document.getElementById('pricing-prod-dd');
    const supplierDD=document.getElementById('pricing-sup-dd');
    const pricingDropdownOpen =
      (lineItemDD && lineItemDD.style.display==='block') ||
      (productDD && productDD.style.display==='block') ||
      (supplierDD && supplierDD.classList.contains('open'));
    if(pricingDropdownOpen && e.target.closest?.('#pricing-modal')) return;
    const root=[...document.querySelectorAll('.modal-overlay')].reverse().find(x=>ENTRY_MODAL_IDS.has(x.id)&&isOpen(x));
    if(root){
      e.preventDefault();e.stopImmediatePropagation();
      if(root.id==='rfq-modal' && typeof window.confirmCancelRFQEntry==='function'){
        window.confirmCancelRFQEntry();
      }else if(root.id==='quote-modal' && typeof window.confirmCancelQuotationEntry==='function'){
        window.confirmCancelQuotationEntry();
      }else if(root.id==='pricing-modal' && typeof window.requestClosePricingEntry==='function'){
        window.requestClosePricingEntry('close');
      }else{
        requestClose(root.id);
      }
    }
  },true);
  window.addEventListener('beforeunload',e=>{
    const dirty=[...states.values()].some(s=>s.dirty);
    if(dirty){e.preventDefault();e.returnValue='';}
  });

  const observer=new MutationObserver(records=>{
    records.forEach(r=>{
      const el=r.target;
      if(el.classList?.contains('modal-overlay')&&ENTRY_MODAL_IDS.has(el.id)&&isOpen(el)){
        setTimeout(()=>initialize(el),30);
      }
    });
  });
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('.modal-overlay').forEach(el=>observer.observe(el,{attributes:true,attributeFilter:['class','style']}));
  });
})();

/* ─────────────────────────────────────────────────────────────
   PRICING GRID — KEYBOARD-FIRST DATA ENTRY
   Spreadsheet-style navigation scoped only to the editable pricing lines.
   ───────────────────────────────────────────────────────────── */
(function initPricingKeyboardNavigation(){
  const GRID = '#pricing-tbody';
  const EDITABLE = 'input[data-role], select[data-role]';
  const roleOrder = ['code','desc','qty','uom','supplier','supref','buy','markup','sell'];

  function activePricingModal(){
    const modal=document.getElementById('pricing-modal');
    return modal && (modal.classList.contains('open') || getComputedStyle(modal).display!=='none') ? modal : null;
  }
  function dataRows(){
    return [...document.querySelectorAll(`${GRID} tr:not(.pricing-quick-add-row)`)].filter(r=>r.offsetParent!==null);
  }
  function fieldAt(row, role){ return row?.querySelector(`[data-role="${role}"]`) || null; }
  function fieldRole(el){ return el?.dataset?.role || ''; }
  function rowIndex(el){ return dataRows().indexOf(el.closest('tr')); }
  function focusField(el, selectValue=true){
    if(!el || el.disabled || el.offsetParent===null) return false;
    el.focus({preventScroll:true});
    el.scrollIntoView({block:'nearest',inline:'nearest'});
    if(selectValue && el.tagName==='INPUT' && ['text','number'].includes(el.type)){
      try{ el.select(); }catch(_){ }
    }
    return true;
  }
  function moveVertical(el, delta){
    const rows=dataRows(), idx=rowIndex(el), role=fieldRole(el);
    if(idx<0 || !role) return false;
    let next=idx+delta;
    if(next<0) next=0;
    if(next>=rows.length){
      if(delta>0){
        // Enter/Down at the last line returns to Quick Add for fast item creation.
        const quick=document.getElementById('pricing-prod-search');
        if(quick) return focusField(quick,false);
      }
      next=rows.length-1;
    }
    return focusField(fieldAt(rows[next],role));
  }
  function moveHorizontal(el, delta){
    const row=el.closest('tr'), role=fieldRole(el), index=roleOrder.indexOf(role);
    if(!row || index<0) return false;
    let targetIndex=index+delta;
    if(targetIndex>=0 && targetIndex<roleOrder.length) return focusField(fieldAt(row,roleOrder[targetIndex]));
    const rows=dataRows(), rIndex=rows.indexOf(row);
    if(delta>0 && rIndex<rows.length-1) return focusField(fieldAt(rows[rIndex+1],roleOrder[0]));
    if(delta<0 && rIndex>0) return focusField(fieldAt(rows[rIndex-1],roleOrder[roleOrder.length-1]));
    return false;
  }
  function caretAtEdge(el, direction){
    if(el.tagName!=='INPUT' || !['text','number'].includes(el.type)) return true;
    if(el.type==='number') return true;
    const start=el.selectionStart, end=el.selectionEnd;
    if(start===null || end===null || start!==end) return false;
    return direction<0 ? start===0 : end===el.value.length;
  }
  function commitField(el){
    // Trigger any existing blur formatting/calculation before moving.
    if(el.matches('[data-role="qty"]')) endQuantityEdit?.(el);
    if(el.matches('[data-role="buy"],[data-role="sell"]')) endPriceEdit?.(el);
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function setActiveRow(el){
    document.querySelectorAll(`${GRID} tr.pricing-keyboard-row`).forEach(r=>r.classList.remove('pricing-keyboard-row'));
    el?.closest('tr:not(.pricing-quick-add-row)')?.classList.add('pricing-keyboard-row');
  }

  document.addEventListener('focusin',e=>{
    if(e.target.matches(`${GRID} ${EDITABLE}`)) setActiveRow(e.target);
  });
  document.addEventListener('focusout',e=>{
    const row=e.target.closest?.(`${GRID} tr`);
    if(row) setTimeout(()=>{ if(!row.contains(document.activeElement)) row.classList.remove('pricing-keyboard-row'); },0);
  });

  document.addEventListener('keydown',e=>{
    if(!activePricingModal()) return;

    // Ctrl/Cmd + S: save pricing from anywhere in the pricing screen.
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s'){
      e.preventDefault();
      if(typeof savePricing==='function') savePricing();
      return;
    }

    const el=e.target;
    if(!el.matches?.(`${GRID} ${EDITABLE}`)) return;
    const isSelect=el.tagName==='SELECT';

    // The description field owns item-list navigation. Do not let the grid-level
    // Arrow Up/Down handler move focus to another pricing row.
    if(el.matches('[data-role="desc"]')){
      const itemListOpen=document.getElementById('pricing-line-item-dd')?.style.display==='block';
      if(e.key==='ArrowDown' || (itemListOpen && ['ArrowUp','Enter','Escape'].includes(e.key))) return;
    }

    if(e.key==='Enter'){
      e.preventDefault();
      commitField(el);
      // Enter follows the same data-entry sequence as Tab.
      // Selling Price is the last editable field, so it moves to the first field of the next row.
      moveHorizontal(el,e.shiftKey?-1:1);
      return;
    }
    if(e.key==='ArrowDown' && !isSelect){
      e.preventDefault(); commitField(el); moveVertical(el,1); return;
    }
    if(e.key==='ArrowUp' && !isSelect){
      e.preventDefault(); commitField(el); moveVertical(el,-1); return;
    }
    if(e.key==='ArrowRight' && !isSelect && caretAtEdge(el,1)){
      e.preventDefault(); commitField(el); moveHorizontal(el,1); return;
    }
    if(e.key==='ArrowLeft' && !isSelect && caretAtEdge(el,-1)){
      e.preventDefault(); commitField(el); moveHorizontal(el,-1); return;
    }
    if(e.key==='Home' && e.ctrlKey){
      e.preventDefault(); focusField(fieldAt(dataRows()[0],roleOrder[0])); return;
    }
    if(e.key==='End' && e.ctrlKey){
      e.preventDefault(); const rows=dataRows(); focusField(fieldAt(rows[rows.length-1],roleOrder[roleOrder.length-1])); return;
    }
  },true);



  // Keyboard selection for the New Item search row.
  let pricingProductKeyboardIndex = -1;
  function pricingProductOptions(){
    return [...document.querySelectorAll('#pricing-prod-dd .pricing-prod-option')].filter(x=>x.offsetParent!==null);
  }
  function highlightPricingProductOption(index){
    const opts=pricingProductOptions();
    opts.forEach(x=>x.classList.remove('pricing-prod-option-active'));
    if(!opts.length){ pricingProductKeyboardIndex=-1; return null; }
    pricingProductKeyboardIndex=Math.max(0,Math.min(index,opts.length-1));
    const opt=opts[pricingProductKeyboardIndex];
    opt.classList.add('pricing-prod-option-active');
    opt.scrollIntoView({block:'nearest'});
    return opt;
  }
  document.addEventListener('input',e=>{
    if(e.target.id==='pricing-prod-search') pricingProductKeyboardIndex=-1;
  },true);
  document.addEventListener('keydown',e=>{
    if(!activePricingModal() || e.target.id!=='pricing-prod-search') return;
    if(e.key==='ArrowDown'){
      e.preventDefault();
      const opts=pricingProductOptions();
      highlightPricingProductOption(pricingProductKeyboardIndex<0?0:pricingProductKeyboardIndex+1);
      return;
    }
    if(e.key==='ArrowUp'){
      e.preventDefault();
      const opts=pricingProductOptions();
      highlightPricingProductOption(pricingProductKeyboardIndex<0?opts.length-1:pricingProductKeyboardIndex-1);
      return;
    }
    if(e.key==='Enter'){
      e.preventDefault();
      const opt=highlightPricingProductOption(pricingProductKeyboardIndex<0?0:pricingProductKeyboardIndex);
      const pid=opt?.dataset?.productId;
      if(pid) addProductToPricing(pid);
      return;
    }
    if(e.key==='Escape'){
      e.preventDefault(); closePricingProdSearch();
    }
  },true);

  // Focus the most useful first field when a new product line is added.
  document.addEventListener('pricing-row-added',e=>{
    const row=e.detail?.row;
    setTimeout(()=>focusField(fieldAt(row,'buy')),0);
  });

  // Wrap the existing add function without changing its pricing logic.
  const originalAdd=window.addPricingRow;
  if(typeof originalAdd==='function'){
    window.addPricingRow=function(item={}){
      const row=originalAdd(item);
      document.dispatchEvent(new CustomEvent('pricing-row-added',{detail:{row,item}}));
      return row;
    };
  }
})();

/* ─────────────────────────────────────────────────────────────
   PRICING KEYBOARD & QUICK-ADD — CORRECTIVE PATCH
   ───────────────────────────────────────────────────────────── */
(function pricingKeyboardCorrectivePatch(){
  let supplierKbIndex = -1;

  function pricingIsOpen(){
    const modal=document.getElementById('pricing-modal');
    return !!(modal && (modal.classList.contains('open') || getComputedStyle(modal).display!=='none'));
  }
  function visibleSupplierOptions(){
    return [...document.querySelectorAll('#pricing-sup-dd .cust-option:not(.add-new)')]
      .filter(el=>el.offsetParent!==null);
  }
  function highlightSupplier(index){
    const opts=visibleSupplierOptions();
    document.querySelectorAll('#pricing-sup-dd .cust-option').forEach(el=>el.classList.remove('pricing-prod-option-active'));
    if(!opts.length){ supplierKbIndex=-1; return null; }
    supplierKbIndex=Math.max(0,Math.min(index,opts.length-1));
    const opt=opts[supplierKbIndex];
    opt.classList.add('pricing-prod-option-active');
    opt.scrollIntoView({block:'nearest'});
    return opt;
  }
  function moveAfterSupplier(){
    const next=document.getElementById('pricing-sup-ref') || document.getElementById('pricing-sup-date');
    if(next){ next.focus(); if(next.select) next.select(); }
  }

  // Replace supplier renderer with keyboard-addressable options.
  window.filterPricingSupDD = function(){
    const input=document.getElementById('pricing-sup-search');
    const dd=document.getElementById('pricing-sup-dd');
    if(!input||!dd) return;
    const q=input.value.toLowerCase();
    const matches=suppliers.filter(s=>!q||s.company.toLowerCase().includes(q));
    const rows=matches.map(s=>`<div class="cust-option" role="option" tabindex="-1" data-supplier-id="${s.id}" onmousedown="selectPricingSupplier('${s.id}')"><div class="co-name">${s.company}</div><div class="co-sub">${s.contact||''} ${s.phone||''}</div></div>`).join('');
    const typed=input.value.trim();
    dd.innerHTML=rows+`<div class="cust-option add-new" role="option" tabindex="-1" onmousedown="quickAddSupplierFromPricing();return false"><i class="ti ti-plus" style="margin-right:5px"></i>Add new supplier${typed?' — '+typed:''}</div>`;
    dd.classList.add('open');
    supplierKbIndex=-1;
  };

  document.addEventListener('keydown',function(e){
    if(!pricingIsOpen() || e.target.id!=='pricing-sup-search') return;
    if(e.key==='ArrowDown'){
      e.preventDefault();
      if(!document.getElementById('pricing-sup-dd')?.classList.contains('open')) filterPricingSupDD();
      highlightSupplier(supplierKbIndex<0?0:supplierKbIndex+1);
      return;
    }
    if(e.key==='ArrowUp'){
      e.preventDefault();
      const opts=visibleSupplierOptions();
      highlightSupplier(supplierKbIndex<0?opts.length-1:supplierKbIndex-1);
      return;
    }
    if(e.key==='Enter'){
      e.preventDefault();
      const opt=highlightSupplier(supplierKbIndex<0?0:supplierKbIndex);
      const id=opt?.dataset?.supplierId;
      if(id){ selectPricingSupplier(id); moveAfterSupplier(); }
      else if(e.target.value.trim()) moveAfterSupplier();
      return;
    }
    if(e.key==='Escape'){
      e.preventDefault(); closePricingSupDD(); supplierKbIndex=-1;
    }
  },true);

  // Selling Price: always continue. Next existing row first; otherwise Quick Add Item.
  document.addEventListener('keydown',function(e){
    if(!pricingIsOpen() || e.key!=='Enter') return;
    const sell=e.target.closest?.('#pricing-tbody input[data-role="sell"]');
    if(!sell) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    try{ endPriceEdit(sell); }catch(_){ }
    sell.dispatchEvent(new Event('change',{bubbles:true}));
    const rows=[...document.querySelectorAll('#pricing-tbody tr:not(.pricing-quick-add-row)')].filter(r=>r.offsetParent!==null);
    const row=sell.closest('tr');
    const idx=rows.indexOf(row);
    const nextRow=idx>=0?rows[idx+1]:null;
    const nextField=nextRow?.querySelector('input[data-role="code"],input[data-role="desc"],input[data-role="qty"],select[data-role="supplier"]');
    if(nextField){
      nextField.focus();
      if(nextField.select) nextField.select();
      nextField.scrollIntoView({block:'nearest',inline:'nearest'});
    }else{
      ensurePricingQuickAddRow();
      const quick=document.getElementById('pricing-prod-search');
      if(quick){
        quick.focus();
        quick.select?.();
        quick.scrollIntoView({block:'nearest',inline:'nearest'});
        openPricingProdSearch();
      }
    }
  },true);

  // Make quick-add actions robust when opened above the Pricing modal.
  const oldQuickSupplier=window.quickAddSupplierFromPricing;
  window.quickAddSupplierFromPricing=function(){
    if(typeof oldQuickSupplier==='function') oldQuickSupplier();
    const modal=document.getElementById('sup-modal');
    if(modal){ modal.style.zIndex='10020'; modal.classList.add('open'); }
  };
  const oldQuickProduct=window.quickAddProductFromPricing;
  window.quickAddProductFromPricing=function(){
    if(typeof oldQuickProduct==='function') oldQuickProduct();
    const modal=document.getElementById('prod-modal');
    if(modal){ modal.style.zIndex='10020'; modal.classList.add('open'); }
    setTimeout(()=>document.getElementById('pm-name')?.focus(),50);
  };

  // Ensure the visible quick-add buttons call the repaired global functions.
  document.addEventListener('click',function(e){
    const supplierAdd=e.target.closest?.('#pricing-sup-dd .add-new');
    if(supplierAdd){ e.preventDefault(); e.stopPropagation(); window.quickAddSupplierFromPricing(); }
    const materialAdd=e.target.closest?.('.pricing-quick-add-row button[title="Create new item"]');
    if(materialAdd){ e.preventDefault(); e.stopPropagation(); window.quickAddProductFromPricing(); }
  },true);
})();

window.addEventListener('DOMContentLoaded',()=>setTimeout(renderTaxSettings,0));


/* ═══════════════════════════════════════════════════════════════════
   EXCEL IMPORT SYSTEM — BizCore
   Supports: Customers, Suppliers, Products, Employees
═══════════════════════════════════════════════════════════════════ */

let _importModule = null;   // 'customers' | 'suppliers' | 'products' | 'employees'
let _importRows   = [];     // parsed + validated rows ready to import
let _importErrors = [];     // rows with errors

/* ── Column definitions per module ── */
const IMPORT_SCHEMAS = {

  customers: {
    label: 'Customers',
    columns: [
      { key:'company',  label:'Company Name *', required:true,  hint:'Full company name' },
      { key:'contact',  label:'Contact Person', required:false, hint:'Primary contact name' },
      { key:'phone',    label:'Phone',          required:false, hint:'+966 5X XXX XXXX' },
      { key:'email',    label:'Email',          required:false, hint:'info@company.com' },
      { key:'city',     label:'City',           required:false, hint:'Riyadh' },
      { key:'vat',      label:'VAT Number',     required:false, hint:'3XXXXXXXXXXXXXXXXX' },
    ],
    example: [
      { 'Company Name *':'ABC Trading Co','Contact Person':'Mr. Ahmed','Phone':'+966 50 123 4567','Email':'ahmed@abc.com','City':'Riyadh','VAT Number':'3100000000000003' },
      { 'Company Name *':'XYZ Supplies LLC','Contact Person':'Ms. Sara','Phone':'+966 55 987 6543','Email':'sara@xyz.com','City':'Jeddah','VAT Number':'' },
    ]
  },

  suppliers: {
    label: 'Suppliers',
    columns: [
      { key:'company',  label:'Company Name *', required:true,  hint:'Full company name' },
      { key:'contact',  label:'Contact Person', required:false, hint:'Primary contact name' },
      { key:'phone',    label:'Phone',          required:false, hint:'+966 5X XXX XXXX' },
      { key:'email',    label:'Email',          required:false, hint:'info@supplier.com' },
      { key:'whatsapp', label:'WhatsApp',       required:false, hint:'+966 5X XXX XXXX' },
      { key:'city',     label:'City',           required:false, hint:'Riyadh' },
      { key:'cat',      label:'Category',       required:false, hint:'Stationery / Electronics / General' },
      { key:'vat',      label:'VAT Number',     required:false, hint:'3XXXXXXXXXXXXXXXXX' },
      { key:'notes',    label:'Notes',          required:false, hint:'Any additional information' },
    ],
    example: [
      { 'Company Name *':'Gulf Supplies Co','Contact Person':'Mr. Ali','Phone':'+966 50 111 2222','Email':'ali@gulf.com','WhatsApp':'+966 50 111 2222','City':'Riyadh','Category':'Stationery','VAT Number':'3200000000000002','Notes':'' },
      { 'Company Name *':'Al-Noor Trading','Contact Person':'Ms. Hessa','Phone':'+966 55 333 4444','Email':'hessa@alnoor.com','WhatsApp':'','City':'Jeddah','Category':'Electronics','VAT Number':'','Notes':'Preferred supplier for IT items' },
    ]
  },

  products: {
    label: 'Products',
    columns: [
      { key:'name',     label:'Product Name *', required:true,  hint:'Full product name' },
      { key:'code',     label:'Product Code',   required:false, hint:'e.g. PP-A4-500' },
      { key:'brand',    label:'Brand',          required:false, hint:'e.g. Roco, Deluxe' },
      { key:'model',    label:'Model',          required:false, hint:'e.g. A4-500' },
      { key:'category', label:'Category',       required:false, hint:'Stationery / Electronics' },
      { key:'uom',      label:'Unit of Measure',required:false, hint:'Pcs / Box / Pkt / Kg / Ltr' },
      { key:'price',    label:'Default Price',  required:false, hint:'Selling price in SAR' },
      { key:'notes',    label:'Notes',          required:false, hint:'Product description or notes' },
    ],
    example: [
      { 'Product Name *':'Roco Printing Paper A4','Product Code':'PP-A4-500','Brand':'Roco','Model':'A4-500','Category':'Stationery','Unit of Measure':'Box','Default Price':'79','Notes':'500 pcs per ream, 5 reams per box' },
      { 'Product Name *':'Deluxe Binder Clip 32mm','Product Code':'BC-32MM','Brand':'Deluxe','Model':'32mm','Category':'Stationery','Unit of Measure':'Pkt','Default Price':'25','Notes':'12 pcs per packet' },
    ]
  },

  employees: {
    label: 'Employees',
    columns: [
      { key:'code',        label:'Employee Code *', required:true,  hint:'Unique code e.g. EMP001' },
      { key:'name',        label:'Full Name *',     required:true,  hint:'Employee full name' },
      { key:'department',  label:'Department',      required:false, hint:'e.g. Sales, Operations' },
      { key:'designation', label:'Designation',     required:false, hint:'e.g. Sales Executive' },
      { key:'email',       label:'Email',           required:false, hint:'emp@company.com' },
      { key:'mobile',      label:'Mobile',          required:false, hint:'+966 5X XXX XXXX' },
      { key:'iqamaNo',     label:'Iqama Number',    required:false, hint:'Iqama / national ID number' },
      { key:'iqamaExpiry', label:'Iqama Expiry',    required:false, hint:'YYYY-MM-DD' },
      { key:'passportNo',  label:'Passport Number', required:false, hint:'Passport number' },
      { key:'passportExpiry',label:'Passport Expiry',required:false,hint:'YYYY-MM-DD' },
    ],
    example: [
      { 'Employee Code *':'EMP001','Full Name *':'Mohammed Al-Otaibi','Department':'Sales','Designation':'Sales Executive','Email':'m.otaibi@downtown.com','Mobile':'+966 50 123 4567','Iqama Number':'2300000001','Iqama Expiry':'2026-12-31','Passport Number':'A12345678','Passport Expiry':'2028-06-30' },
      { 'Employee Code *':'EMP002','Full Name *':'Fatima Al-Zahrani','Department':'Operations','Designation':'Operations Manager','Email':'f.zahrani@downtown.com','Mobile':'+966 55 987 6543','Iqama Number':'','Iqama Expiry':'','Passport Number':'','Passport Expiry':'' },
    ]
  }
};

/* ── Open the import modal ── */
function openImportModal(module) {
  _importModule = module;
  _importRows   = [];
  _importErrors = [];
  const schema = IMPORT_SCHEMAS[module];
  if (!schema) return;

  // Reset UI
  document.getElementById('import-modal-title').textContent = 'Import ' + schema.label + ' from Excel';
  document.getElementById('import-preview-area').style.display = 'none';
  document.getElementById('import-preview-area').innerHTML = '';
  document.getElementById('import-file-input').value = '';
  document.getElementById('import-confirm-btn').disabled = true;
  document.getElementById('import-confirm-btn').style.opacity = '.5';
  document.getElementById('import-confirm-btn').style.cursor = 'not-allowed';
  document.getElementById('import-step3-num').style.background = 'var(--gray-light)';
  document.getElementById('import-step3-num').style.color = 'var(--gray)';
  document.getElementById('import-drop-zone').style.borderColor = '';
  document.getElementById('import-drop-zone').style.background = '#fafbfc';
  openModalWithSize('import-modal');
}

/* ── Download blank template with headers + example rows ── */
function downloadImportTemplate() {
  if (!_importModule) return;
  const schema = IMPORT_SCHEMAS[_importModule];
  if (typeof XLSX === 'undefined') { showToast('Excel library not loaded — check internet connection','error'); return; }

  const headers = schema.columns.map(c => c.label);
  const hints   = ['Column guide →', ...schema.columns.map(c => c.hint || '')];

  // Build worksheet data: hint row, blank separator, example rows
  const wsData = [
    headers,
    hints,
    [], // blank separator so user starts entering data on row 4
    ...schema.example,
  ].map((row, ri) => {
    if (Array.isArray(row)) return row; // headers / hints arrays
    return headers.map(h => row[h] !== undefined ? row[h] : '');
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Style column widths
  ws['!cols'] = schema.columns.map(() => ({ wch: 22 }));

  // Freeze the header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(wb, ws, schema.label);
  XLSX.writeFile(wb, 'BizCore_' + schema.label + '_Import_Template.xlsx');
  showToast('Template downloaded — fill in rows 4 onwards, then upload', 'success');
}

/* ── Handle file drop ── */
function handleImportDrop(e) {
  e.preventDefault();
  e.currentTarget.style.borderColor = '';
  e.currentTarget.style.background = '#fafbfc';
  const file = e.dataTransfer?.files?.[0];
  if (file) processImportFile(file);
}

/* ── Handle file input change ── */
function handleImportFile(e) {
  const file = e.target.files?.[0];
  if (file) processImportFile(file);
}

/* ── Parse the uploaded Excel file ── */
function processImportFile(file) {
  if (!file.name.match(/\.xlsx?$/i)) {
    showToast('Please upload an .xlsx or .xls file', 'error'); return;
  }
  if (typeof XLSX === 'undefined') {
    showToast('Excel library not loaded — check internet connection', 'error'); return;
  }

  const schema  = IMPORT_SCHEMAS[_importModule];
  const reader  = new FileReader();
  reader.onload = function(ev) {
    try {
      const wb    = XLSX.read(ev.target.result, { type:'array', cellDates:true });
      const wsName = wb.SheetNames[0];
      const ws    = wb.Sheets[wsName];
      const raw   = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });

      if (!raw.length) { showToast('The file appears to be empty', 'error'); return; }

      // Find the header row (first row containing a required column label)
      const requiredLabel = schema.columns.find(c => c.required)?.label || schema.columns[0].label;
      let headerRowIdx = -1;
      for (let i = 0; i < Math.min(raw.length, 5); i++) {
        if (raw[i].some(cell => String(cell||'').trim() === requiredLabel)) {
          headerRowIdx = i; break;
        }
      }
      if (headerRowIdx === -1) {
        showToast('Could not find the header row — make sure you used the downloaded template', 'error'); return;
      }

      const headers = raw[headerRowIdx].map(h => String(h||'').trim());
      const dataRows = raw.slice(headerRowIdx + 1);

      // Map column label → key
      const colMap = {};
      schema.columns.forEach(col => {
        const hi = headers.findIndex(h => h === col.label);
        if (hi >= 0) colMap[hi] = col.key;
      });

      _importRows   = [];
      _importErrors = [];

      dataRows.forEach((row, ri) => {
        // Skip completely blank rows (like the hint row in our template)
        if (row.every(c => !String(c||'').trim())) return;
        // Also skip the hint/guide rows
        const firstCell = String(row[0]||'').trim();
        if (firstCell === 'Column guide →') return;

        const record = {};
        headers.forEach((_, hi) => {
          const key = colMap[hi];
          if (key) record[key] = String(row[hi]||'').trim();
        });

        // Validate required fields
        const missing = schema.columns.filter(c => c.required && !record[c.key]);
        if (missing.length) {
          _importErrors.push({ row: ri + headerRowIdx + 2, record, reason: 'Missing: ' + missing.map(c=>c.label).join(', ') });
          return;
        }

        // Module-specific duplicate check against existing data
        let duplicate = false;
        if (_importModule === 'customers') {
          duplicate = customers.some(c => c.company.toLowerCase() === (record.company||'').toLowerCase());
        } else if (_importModule === 'suppliers') {
          duplicate = suppliers.some(s => s.company.toLowerCase() === (record.company||'').toLowerCase());
        } else if (_importModule === 'products') {
          duplicate = record.code && products.some(p => p.code && p.code.toLowerCase() === record.code.toLowerCase());
        } else if (_importModule === 'employees') {
          duplicate = employees.some(e => e.code.toLowerCase() === (record.code||'').toLowerCase());
        }

        if (duplicate) {
          _importErrors.push({ row: ri + headerRowIdx + 2, record, reason: 'Duplicate — already exists in BizCore' });
          return;
        }

        _importRows.push(record);
      });

      renderImportPreview();
    } catch(err) {
      showToast('Error reading file: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

/* ── Render preview/summary after parsing ── */
function renderImportPreview() {
  const schema   = IMPORT_SCHEMAS[_importModule];
  const previewEl = document.getElementById('import-preview-area');
  const btnEl     = document.getElementById('import-confirm-btn');
  const step3num  = document.getElementById('import-step3-num');

  const readyCount = _importRows.length;
  const errCount   = _importErrors.length;
  const total      = readyCount + errCount;

  // Activate step 3
  step3num.style.background = readyCount > 0 ? 'var(--blue)' : '#e74c3c';
  step3num.style.color = '#fff';

  let html = '';

  // Summary bar
  html += '<div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">';
  html += `<div style="flex:1;min-width:120px;background:#EAF2FA;border-radius:8px;padding:12px 16px;text-align:center">
    <div style="font-size:24px;font-weight:800;color:var(--blue)">${total}</div>
    <div style="font-size:11px;color:var(--gray);margin-top:2px">Rows found</div></div>`;
  html += `<div style="flex:1;min-width:120px;background:${readyCount>0?'#e8f8f0':'#f8f9fa'};border-radius:8px;padding:12px 16px;text-align:center">
    <div style="font-size:24px;font-weight:800;color:${readyCount>0?'#16a34a':'var(--gray)'}">${readyCount}</div>
    <div style="font-size:11px;color:var(--gray);margin-top:2px">Ready to import</div></div>`;
  html += `<div style="flex:1;min-width:120px;background:${errCount>0?'#fef3f2':'#f8f9fa'};border-radius:8px;padding:12px 16px;text-align:center">
    <div style="font-size:24px;font-weight:800;color:${errCount>0?'#e74c3c':'var(--gray)'}">${errCount}</div>
    <div style="font-size:11px;color:var(--gray);margin-top:2px">Skipped (errors)</div></div>`;
  html += '</div>';

  // Ready rows preview (first 5)
  if (readyCount > 0) {
    const firstKey = schema.columns.find(c => c.required)?.key || schema.columns[0].key;
    const secondKey = schema.columns[1]?.key;
    html += `<div style="font-size:12px;font-weight:700;color:var(--blue);margin-bottom:6px">
      <i class="ti ti-circle-check" style="margin-right:4px"></i>Records ready to import:</div>`;
    html += '<div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:12px">';
    _importRows.slice(0, 5).forEach((r, i) => {
      html += `<div style="padding:7px 12px;font-size:12px;${i>0?'border-top:1px solid #f0f0f0':''}">
        <span style="font-weight:600;color:var(--blue)">${r[firstKey]}</span>
        ${r[secondKey] ? `<span style="color:var(--gray);margin-left:8px">${r[secondKey]}</span>` : ''}
      </div>`;
    });
    if (readyCount > 5) {
      html += `<div style="padding:7px 12px;font-size:11px;color:var(--gray);background:#fafafa;border-top:1px solid #f0f0f0">
        + ${readyCount - 5} more records...</div>`;
    }
    html += '</div>';
  }

  // Error rows
  if (errCount > 0) {
    html += `<div style="font-size:12px;font-weight:700;color:#e74c3c;margin-bottom:6px">
      <i class="ti ti-alert-circle" style="margin-right:4px"></i>Rows skipped (will NOT be imported):</div>`;
    html += '<div style="border:1px solid #fecaca;border-radius:6px;overflow:hidden;margin-bottom:12px">';
    _importErrors.slice(0, 5).forEach((e, i) => {
      const firstKey = schema.columns[0].key;
      html += `<div style="padding:7px 12px;font-size:12px;${i>0?'border-top:1px solid #fee2e2':''}">
        <span style="color:var(--gray)">Row ${e.row}:</span>
        <span style="margin-left:6px;font-weight:600">${e.record[firstKey]||'(blank)'}</span>
        <span style="margin-left:8px;color:#e74c3c;font-size:11px">${e.reason}</span>
      </div>`;
    });
    if (errCount > 5) {
      html += `<div style="padding:7px 12px;font-size:11px;color:#e74c3c;background:#fff5f5;border-top:1px solid #fee2e2">
        + ${errCount - 5} more errors...</div>`;
    }
    html += '</div>';
  }

  if (readyCount === 0 && errCount === 0) {
    html += '<div style="text-align:center;color:var(--gray);padding:20px;font-size:13px">No data rows found in the file. Make sure to fill in data from row 4 onwards in the template.</div>';
  }

  previewEl.innerHTML = html;
  previewEl.style.display = 'block';

  // Enable/disable import button
  if (readyCount > 0) {
    btnEl.disabled = false;
    btnEl.style.opacity = '1';
    btnEl.style.cursor = 'pointer';
    btnEl.innerHTML = '<i class="ti ti-check"></i> Import ' + readyCount + ' Record' + (readyCount>1?'s':'');
  } else {
    btnEl.disabled = true;
    btnEl.style.opacity = '.5';
    btnEl.style.cursor = 'not-allowed';
    btnEl.innerHTML = '<i class="ti ti-check"></i> Import Records';
  }
}

/* ── Confirm and save imported records ── */
async function confirmImport() {
  if (!_importRows.length || !_importModule) return;

  const count = _importRows.length;

  if (_importModule === 'customers') {
    _importRows.forEach(r => {
      const contacts = r.contact ? [{ name:r.contact, title:'', phone:r.phone||'', isDefault:true }] : [];
      customers.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2,5),
        company:  r.company,
        city:     r.city||'',
        vat:      r.vat||'',
        contacts,
        contact:  r.contact||'',
        phone:    r.phone||'',
        email:    r.email||''
      });
    });
    await saveCustomers();
    renderCustomers();
    if (typeof renderSetupCustTable === 'function') renderSetupCustTable();

  } else if (_importModule === 'suppliers') {
    _importRows.forEach(r => {
      suppliers.push({
        id:       's' + Date.now().toString(36) + Math.random().toString(36).slice(2,5),
        company:  r.company,
        contact:  r.contact||'',
        phone:    r.phone||'',
        email:    r.email||'',
        whatsapp: r.whatsapp||'',
        city:     r.city||'',
        cat:      r.cat||'',
        vat:      r.vat||'',
        notes:    r.notes||''
      });
    });
    saveSuppliers();
    renderSuppliers();

  } else if (_importModule === 'products') {
    _importRows.forEach(r => {
      products.push({
        id:       'p' + Date.now().toString(36) + Math.random().toString(36).slice(2,5),
        name:     r.name,
        code:     r.code||'',
        brand:    r.brand||'',
        model:    r.model||'',
        category: r.category||'',
        uom:      r.uom||'Pcs',
        price:    parseFloat(r.price)||0,
        notes:    r.notes||'',
        specs:    [],
        image:    null
      });
    });
    await saveProducts();
    renderProducts();

  } else if (_importModule === 'employees') {
    _importRows.forEach(r => {
      employees.push({
        id:             'emp-' + Date.now().toString(36) + Math.random().toString(36).slice(2,5),
        code:           r.code,
        name:           r.name,
        department:     r.department||'',
        designation:    r.designation||'',
        email:          r.email||'',
        mobile:         r.mobile||'',
        roles:          [],
        iqamaNo:        r.iqamaNo||'',
        iqamaExpiry:    r.iqamaExpiry||'',
        passportNo:     r.passportNo||'',
        passportExpiry: r.passportExpiry||'',
        licenseNo:      '',
        licenseExpiry:  '',
        active:         true,
        photo:          null
      });
    });
    await saveEmployees();
    renderEmployees();
  }

  closeModal('import-modal');
  showToast(count + ' ' + IMPORT_SCHEMAS[_importModule].label.slice(0,-1) + (count>1?'s':'') + ' imported successfully', 'success');
  _importRows = []; _importErrors = []; _importModule = null;
}

/* ═══════════════════════════════════════════════════════════════════
   END EXCEL IMPORT SYSTEM
═══════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════
   DOCUMENT PRESENCE LOCKING SYSTEM
   Prevents two users editing the same document at the same time.
   Uses Firebase Firestore 'locks' collection.
═══════════════════════════════════════════════════════════════════ */

/* Active lock state for this session */
let _activeLock      = null;  // { docType, docId }
let _heartbeatTimer  = null;  // setInterval handle
let _activityTimer   = null;  // setTimeout handle for idle detection
let _lastActivity    = Date.now();
let _lockWatcher     = null;  // onSnapshot unsubscribe

const IDLE_TIMEOUT_MS   = 30 * 60 * 1000;  // 30 min idle → auto-release
const HEARTBEAT_MS      = 60 * 1000;        // ping Firebase every 60s

/* ── Track user activity to reset idle timer ── */
['keydown','mousedown','touchstart','scroll'].forEach(function(evt) {
  document.addEventListener(evt, function() {
    _lastActivity = Date.now();
    if (_activeLock) resetIdleTimer();
  }, { passive: true });
});

function resetIdleTimer() {
  clearTimeout(_activityTimer);
  _activityTimer = setTimeout(function() {
    // User has been idle for 30 minutes — release lock
    if (_activeLock) {
      console.log('Idle 30min — auto-releasing lock');
      releaseLock();
      showToast('Lock released after 30 minutes of inactivity. Your work is saved.', 'error');
    }
  }, IDLE_TIMEOUT_MS);
}

/* ── Acquire lock before opening a document for editing ──
   Returns true if lock granted, false if locked by someone else.
   Shows the lock conflict UI automatically if blocked. ── */
async function acquireDocLock(docType, docId, docLabel) {
  if (!window.FB || !window.FB.acquireLock) return true; // Firebase not ready
  if (!window.currentUser) return true; // not logged in

  const result = await window.FB.acquireLock(docType, docId);

  if (result.granted) {
    // Lock acquired — set up heartbeat and idle timer
    _activeLock = { docType, docId };
    startHeartbeat();
    resetIdleTimer();

    // Watch for takeover by another user
    _lockWatcher = window.FB.watchLock(docType, docId, function(lockData) {
      if (!lockData) return; // lock released
      if (lockData.uid !== window.currentUser.uid) {
        // Someone took over our lock
        showToast(
          (lockData.name || lockData.email) + ' has taken over this document.',
          'error'
        );
        stopHeartbeat();
        _activeLock = null;
      }
    });
    return true;
  }

  // Lock denied — show conflict dialog
  showLockConflict(docType, docId, docLabel, result);
  return false;
}

/* ── Release the current lock ── */
async function releaseLock() {
  if (!_activeLock) return;
  const { docType, docId } = _activeLock;
  stopHeartbeat();
  if (_lockWatcher) { _lockWatcher(); _lockWatcher = null; }
  clearTimeout(_activityTimer);
  if (window.FB && window.FB.releaseLock) {
    await window.FB.releaseLock(docType, docId);
  }
  _activeLock = null;
}

/* ── Start/stop heartbeat ── */
function startHeartbeat() {
  stopHeartbeat();
  _heartbeatTimer = setInterval(function() {
    if (_activeLock && window.FB && window.FB.heartbeat) {
      window.FB.heartbeat(_activeLock.docType, _activeLock.docId);
    }
  }, HEARTBEAT_MS);
}

function stopHeartbeat() {
  if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
}

/* ── Release lock when user navigates away or closes tab ── */
window.addEventListener('beforeunload', function() {
  // Synchronous lock release via navigator.sendBeacon not possible with Firestore
  // Best effort: stop heartbeat so lock expires on next idle check
  stopHeartbeat();
});

document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    // Page hidden (tab switched) — continue heartbeat but note time
    _lastActivity = Date.now();
  }
});

/* ── Lock conflict dialog ── */
function showLockConflict(docType, docId, docLabel, lockInfo) {
  // Remove any existing conflict dialog
  const existing = document.getElementById('lock-conflict-modal');
  if (existing) existing.remove();

  const since     = lockInfo.since ? new Date(lockInfo.since) : null;
  const sinceStr  = since ? since.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '—';
  const idleStr   = lockInfo.idleMins > 0
    ? `<span style="color:#F15A25">Idle for ${lockInfo.idleMins} min</span>`
    : '<span style="color:#16a34a">Active just now</span>';

  const modal = document.createElement('div');
  modal.id = 'lock-conflict-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:32px;max-width:440px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.25)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
        <div style="width:44px;height:44px;border-radius:50%;background:#FEF3F2;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="ti ti-lock" style="font-size:22px;color:#DC2626"></i>
        </div>
        <div>
          <div style="font-size:15px;font-weight:700;color:#1a1a1a">Document in use</div>
          <div style="font-size:12px;color:#8B98A8;margin-top:2px">${docLabel || docType + ' ' + docId}</div>
        </div>
      </div>

      <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px;margin-bottom:20px">
        <div style="font-size:13px;color:#1a1a1a;margin-bottom:10px">
          <i class="ti ti-user" style="color:#0B539D;margin-right:6px"></i>
          <strong>${lockInfo.lockedBy || lockInfo.lockedByEmail}</strong> is currently editing this document.
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div style="background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:10px">
            <div style="font-size:10px;color:#8B98A8;margin-bottom:3px;text-transform:uppercase;letter-spacing:.5px">Editing since</div>
            <div style="font-size:13px;font-weight:600;color:#1a1a1a">${sinceStr}</div>
          </div>
          <div style="background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:10px">
            <div style="font-size:10px;color:#8B98A8;margin-bottom:3px;text-transform:uppercase;letter-spacing:.5px">Status</div>
            <div style="font-size:13px;font-weight:600">${idleStr}</div>
          </div>
        </div>
        ${lockInfo.idleMins >= 5
          ? `<div style="margin-top:10px;padding:8px 12px;background:#FFFBEA;border:1px solid #F0D77B;border-radius:6px;font-size:12px;color:#7A5A00">
              <i class="ti ti-info-circle" style="margin-right:4px"></i>
              This user has been idle for ${lockInfo.idleMins} minutes — they may have stepped away.
             </div>`
          : ''}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <button onclick="closeLockConflict()"
          style="height:38px;border:1.5px solid #E2E8F0;border-radius:8px;background:#fff;cursor:pointer;font-size:12px;font-weight:600;color:#5A6677">
          Cancel
        </button>
        <button onclick="viewDocReadOnly('${docType}','${docId}')"
          style="height:38px;border:1.5px solid #0B539D;border-radius:8px;background:#fff;cursor:pointer;font-size:12px;font-weight:600;color:#0B539D">
          <i class="ti ti-eye" style="margin-right:4px"></i>View only
        </button>
        <button onclick="takeoverLock('${docType}','${docId}','${(lockInfo.lockedBy||lockInfo.lockedByEmail).replace(/'/g,"\\'")}','${docLabel||''}')"
          style="height:38px;border:none;border-radius:8px;background:#DC2626;cursor:pointer;font-size:12px;font-weight:600;color:#fff">
          <i class="ti ti-lock-open" style="margin-right:4px"></i>Take over
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function closeLockConflict() {
  const m = document.getElementById('lock-conflict-modal');
  if (m) m.remove();
}

/* ── View document in read-only mode ── */
function viewDocReadOnly(docType, docId) {
  closeLockConflict();
  // Route to the appropriate view function (read-only — no edit)
  if (docType === 'quotation') {
    const q = quotations.find(x => x.id === docId);
    if (q) viewQuotation(docId);
  } else if (docType === 'rfq') {
    viewRFQ(docId);
  } else if (docType === 'salesorder') {
    viewSO(docId);
  } else if (docType === 'customer') {
    viewCustomer(docId);
  } else if (docType === 'supplier') {
    viewSupplier && viewSupplier(docId);
  }
}

/* ── Take over a lock from another user ── */
async function takeoverLock(docType, docId, lockedByName, docLabel) {
  const confirmed = await showConfirmAsync({
    icon: '⚠️',
    title: 'Take over editing?',
    message: lockedByName + ' is editing this document. If they have unsaved changes, those will be lost when they try to save.\n\nAre you sure you want to take over?',
    confirmText: 'Take over',
    confirmClass: 'btn-danger'
  });
  if (!confirmed) return;

  closeLockConflict();
  if (window.FB && window.FB.takeover) {
    await window.FB.takeover(docType, docId);
  }
  _activeLock = { docType, docId };
  startHeartbeat();
  resetIdleTimer();

  // Now open the document for editing
  if (docType === 'quotation')  editQuotation(docId);
  else if (docType === 'rfq')   editRFQ(docId);
  else if (docType === 'customer') { /* trigger edit mode in customer view */ }

  showToast('You now have exclusive editing access to this document.', 'success');
}

/* ── Helper: Promise-based confirm dialog ── */
function showConfirmAsync(opts) {
  return new Promise(function(resolve) {
    const existing = document.getElementById('confirm-async-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'confirm-async-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:28px;max-width:380px;width:100%;box-shadow:0 16px 48px rgba(0,0,0,.2)">
        <div style="font-size:22px;margin-bottom:10px">${opts.icon||'⚠️'}</div>
        <div style="font-size:15px;font-weight:700;margin-bottom:8px">${opts.title||'Confirm'}</div>
        <div style="font-size:13px;color:#5A6677;margin-bottom:20px;white-space:pre-line">${opts.message||''}</div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button onclick="document.getElementById('confirm-async-modal').remove();window._confirmResolve(false)"
            style="height:36px;padding:0 16px;border:1.5px solid #E2E8F0;border-radius:7px;background:#fff;cursor:pointer;font-size:13px;font-weight:600">
            Cancel
          </button>
          <button onclick="document.getElementById('confirm-async-modal').remove();window._confirmResolve(true)"
            style="height:36px;padding:0 16px;border:none;border-radius:7px;background:#DC2626;color:#fff;cursor:pointer;font-size:13px;font-weight:600">
            ${opts.confirmText||'Confirm'}
          </button>
        </div>
      </div>`;
    window._confirmResolve = resolve;
    document.body.appendChild(modal);
  });
}

/* ═══════════════════════════════════════════════════════════════════
   HOOK LOCKS INTO EXISTING EDIT FUNCTIONS
   Wrap the existing edit functions to check locks first
═══════════════════════════════════════════════════════════════════ */

/* Store original functions */
const _origEditQuotation = typeof editQuotation === 'function' ? editQuotation : null;
const _origEditRFQ       = typeof editRFQ       === 'function' ? editRFQ       : null;

/* Wrap editQuotation */
if (_origEditQuotation) {
  editQuotation = async function(id, skipVatCheck) {
    const q = quotations.find(x => x.id === id);
    const label = q ? ('Quotation ' + (q.qno || id)) : ('Quotation ' + id);
    // Release any existing lock first
    if (_activeLock && (_activeLock.docId !== id || _activeLock.docType !== 'quotation')) {
      await releaseLock();
    }
    if (_activeLock && _activeLock.docId === id) {
      // Already have this lock
      _origEditQuotation(id, skipVatCheck);
      return;
    }
    const granted = await acquireDocLock('quotation', id, label);
    if (granted) _origEditQuotation(id, skipVatCheck);
  };
}

/* Wrap editRFQ */
if (_origEditRFQ) {
  editRFQ = async function(id) {
    const r = rfqs.find(x => x.id === id);
    const label = r ? ('RFQ ' + (r.rfqno || id)) : ('RFQ ' + id);
    if (_activeLock && (_activeLock.docId !== id || _activeLock.docType !== 'rfq')) {
      await releaseLock();
    }
    if (_activeLock && _activeLock.docId === id) {
      _origEditRFQ(id); return;
    }
    const granted = await acquireDocLock('rfq', id, label);
    if (granted) _origEditRFQ(id);
  };
}

/* Release lock when save modals close */
const _origSaveQuotation = typeof saveQuotation === 'function' ? saveQuotation : null;
if (_origSaveQuotation) {
  saveQuotation = async function(...args) {
    const result = await _origSaveQuotation(...args);
    await releaseLock();
    return result;
  };
}

const _origSaveRFQ = typeof saveRFQ === 'function' ? saveRFQ : null;
if (_origSaveRFQ) {
  saveRFQ = async function() {
    await _origSaveRFQ();
    await releaseLock();
  };
}

/* Release lock when cancel buttons are clicked (modal close) */
(function() {
  const orig = window.closeModal;
  if (typeof orig === 'function') {
    window.closeModal = async function(id) {
      if (id === 'quote-modal' || id === 'rfq-modal') {
        await releaseLock();
      }
      if(id==='quote-modal'){
        document._pendingQuotationRevision=null;
        document._pendingRFQId=null;
        document._pendingPricingVersion=null;
      }
      orig(id);
    };
  }
})();

console.log('Document locking system active ✅');

/* ═══════════════════════════════════════════════════════════════════
   END DOCUMENT PRESENCE LOCKING SYSTEM
═══════════════════════════════════════════════════════════════════ */

window.addEventListener('load',()=>{
  if(!new URLSearchParams(location.search).get('dn')) return;
  let attempts=0;
  const routeDN=()=>{
    attempts++;
    if(openDNFromDeepLink() || attempts>=40) return;
    setTimeout(routeDN,250);
  };
  setTimeout(routeDN,100);
});
